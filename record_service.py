"""B2B 내 엑셀 녹화 서비스 (ixi-Cell-R recorder 통합).

사용자가 라이브 미러(진짜 Excel 창)에서 직접 작업한 것을 캡처해, 정지 시
distill(정제) → 역할 기반 그룹핑 → B2B 파이프라인 스텝(ctx 코드)으로 변환한다.

스레딩 모델:
  녹화는 전용 데몬 스레드(자체 STA)에서 돈다. B2B 의 Excel STA 워커를 점유하면
  녹화 중 다른 Excel 작업(채팅 등)이 전부 막히기 때문. Excel Application 프록시는
  Excel 워커 스레드에서 CoMarshalInterThreadInterfaceInStream 으로 마샬링해 넘겨받고
  (marshal_app_stream), 스트림이 없으면 GetActiveObject 로 실행 중 인스턴스를 잡는다
  (B2B 는 단일 Excel 인스턴스 정책이라 안전).

정지 시퀀스(flush→deferred→sort/filter/dimension/format/object diff→reconcile)는
ixi-Cell-R cli.py 의 검증된 순서를 그대로 따른다 — 순서를 바꾸지 말 것(피벗 출력
셀 정리가 서식 뒤라야 동작).
"""
from __future__ import annotations

import threading
import time
import traceback

from ixicellr.distiller import distill
from ixicellr.distiller.intent import (
    HAZARD_LABELS, ROLE_COPY, ROLE_FORMAT, ROLE_FORMULA, ROLE_LITERAL,
    ROLE_STRUCTURE, analyze_step,
)
from ixicellr.model import a1
from ixicellr.model.action_ir import CELL_EDIT, RANGE_FILL, Target
from ixicellr.model.skill import Step
from ixicellr.runtime import constants as C
from ixicellr.skillstore.eval_eca_export import step_to_lines

ROLE_TITLES = {
    ROLE_STRUCTURE: "구조 변경",
    ROLE_FORMAT: "서식",
    ROLE_FORMULA: "수식 입력",
    ROLE_LITERAL: "값 입력",
    ROLE_COPY: "복사/붙여넣기",
    "other": "기타 작업",
}


# ── 재현 검증용 기대 상태 다이제스트 ──────────────────────────────
# 레코더는 정지 시점에 '정답'(사용자가 만든 최종 상태)을 보고 있다. 이를 시트별
# 다이제스트로 남겨, 재현(전체실행) 후 라이브 상태와 자동 대조한다 — 어긋나면
# "어느 시트가 어떻게 다른지"를 사용자에게 정확히 알려줄 수 있다.

DIGEST_MAX_CELLS = 200_000  # 시트당 값 판독 상한(저사양 보호) — 초과분은 상단 창만 해시


# ── [계측 2026-08-31] 시작/정지 사이가 로그에 안 남아 있었다 ────────────────────────
# serve_b2b 는 start/stop 두 시점만 남긴다. 그런데 정작 녹화가 통째로 유실되는 자리는
# 그 사이다: 펌프 루프가 Excel 사망을 감지해 break 하거나, 정지 시퀀스 7단계가 각각
# try/except pass 로 조용히 삼켜지거나, distill→그룹핑→스텝 변환에서 개수가 0으로
# 줄어드는 경우. 그때 화면에는 "캡처 0건"만 뜨고 로그에는 아무 단서가 없었다.
#
# serve_b2b 를 import 하면 순환이 되므로 훅으로 받는다(없으면 호출 시점에 늦게 import).
# _vba_trace 는 쓰기 락을 잡으므로 녹화 전용 스레드에서 불러도 안전하다.
TRACE_HOOK = None


def _trace(event, **fields):
    fn = TRACE_HOOK
    if fn is None:
        try:
            import serve_b2b as _s
            fn = _s._vba_trace
        except Exception:
            return
    try:
        fn(event, **fields)
    except Exception:
        pass                      # 계측이 녹화를 깨뜨리면 안 된다


def _norm_cell(v):
    """Value2 셀값 정규화 — 재현 전후 부동소수 미세오차/None 표기 차이를 흡수."""
    if v is None:
        return ""
    if isinstance(v, float):
        if v == int(v) and abs(v) < 1e15:
            return str(int(v))
        return repr(round(v, 9))
    return str(v)


def digest_grid(values):
    """UsedRange.Value2 결과(스칼라/1행/2D 튜플)를 정규화해 sha1 16자리 다이제스트."""
    import hashlib
    if values is None:
        rows = []
    elif not isinstance(values, (list, tuple)):
        rows = [[values]]
    else:
        rows = [r if isinstance(r, (list, tuple)) else [r] for r in values]
    h = hashlib.sha1()
    for r in rows:
        h.update("\x1f".join(_norm_cell(c) for c in r).encode("utf-8", "replace"))
        h.update(b"\x1e")
    return h.hexdigest()[:16]


MERGE_SCAN_MAX_ROWS = 1500   # 병합 스캔 행 상한(저사양 보호) — 초과 시 상단만, 마커로 표기
MERGE_SCAN_MAX_CELLS = 6000  # 병합 행 내부 셀 스캔 총량 상한


def sheet_merge_areas(ws, max_rows=MERGE_SCAN_MAX_ROWS, max_cells=MERGE_SCAN_MAX_CELLS):
    """시트의 병합 영역 주소 목록(정렬) — 재현 검증용 병합 지문.

    병합은 좌상단 외 셀 값을 지우는 파괴적 연산이라, 재현이 병합 범위를 넓히면(행별
    병합 7개 → 통짜 1개, 실사례) 값 다이제스트만으로도 어긋나지만 '왜'를 못 짚는다.
    2단 스캔으로 싸게 잡는다: ① 행 단위 MergeCells 3상태(False=병합 없음 → 건너뜀)
    ② 병합 있는 행만 셀 단위 MergeArea 수집. 상한 도달 시 마커를 넣어 양쪽(녹화/재현)
    이 같은 조건으로 비교되게 한다."""
    ur = ws.UsedRange
    rows = int(ur.Rows.Count)
    cols = int(ur.Columns.Count)
    areas = set()
    capped = False
    try:
        if ur.MergeCells is False:  # 시트 전체에 병합 없음 — fast path
            return []
    except Exception:
        pass  # 혼합(None)/실패 → 행 스캔으로
    scan_rows = min(rows, max_rows)
    if scan_rows < rows:
        capped = True
    scanned = 0
    for r in range(1, scan_rows + 1):
        try:
            row_mc = ur.Rows(r).MergeCells
        except Exception:
            row_mc = None
        if row_mc is False:
            continue
        for c in range(1, cols + 1):
            scanned += 1
            if scanned > max_cells:
                capped = True
                break
            try:
                cell = ur.Cells(r, c)
                if cell.MergeCells:
                    areas.add(str(cell.MergeArea.Address).replace("$", ""))
            except Exception:
                continue
        if capped:
            break
    out = sorted(areas)
    if capped:
        out.append(f"(capped:{scan_rows}r)")
    return out


def sheet_expected_state(ws, max_cells=DIGEST_MAX_CELLS):
    """시트 하나의 기대 상태 {sheet, rows, cols, hashRows, hash, merges}.

    상한 초과 대형 시트는 상단 hashRows 행만 해시(양쪽이 같은 함수를 쓰므로 대조 가능).
    UsedRange 치수는 항상 남겨 큰 구조 어긋남(행 밀림 등)은 치수만으로도 잡힌다.
    merges 는 병합 영역 지문(위 sheet_merge_areas) — 병합 어긋남을 정확히 지목한다."""
    ur = ws.UsedRange
    rows = int(ur.Rows.Count)
    cols = int(ur.Columns.Count)
    hash_rows = rows
    if rows * max(cols, 1) > max_cells:
        hash_rows = max(1, max_cells // max(cols, 1))
    values = ur.Value2 if hash_rows == rows else ur.Resize(hash_rows, cols).Value2
    try:
        merges = sheet_merge_areas(ws)
    except Exception:
        merges = None  # 병합 지문 실패는 값 검증을 막지 않는다
    return {"sheet": str(ws.Name), "rows": rows, "cols": cols,
            "hashRows": hash_rows, "hash": digest_grid(values), "merges": merges}


def capture_expected_states(app, touched):
    """touched {(book_key, sheet)} 시트들의 정지 시점 기대 상태 목록(재현 검증용).

    실패는 건너뛴다(best-effort) — 검증은 보조 기능이라 녹화 결과 자체를 막으면 안 된다."""
    from ixicellr.workbooks.registry import basename_of
    by_book = {}
    for bk, sh in (touched or set()):
        by_book.setdefault(basename_of(str(bk)), set()).add(sh)
    expected = []
    for wb in app.Workbooks:
        try:
            base = str(wb.Name)
        except Exception:
            continue
        sheets = by_book.get(base)
        if not sheets:
            continue
        for ws in wb.Worksheets:
            try:
                if str(ws.Name) not in sheets:
                    continue
                st = sheet_expected_state(ws)
                st["book"] = base
                expected.append(st)
            except Exception:
                continue
    return expected


def marshal_app_stream(app):
    """Excel 워커 스레드에서 호출 — Application 프록시를 스레드 간 스트림으로 마샬링."""
    import pythoncom
    return pythoncom.CoMarshalInterThreadInterfaceInStream(
        pythoncom.IID_IDispatch, app._oleobj_)


def _unmarshal_app(stream):
    import pythoncom
    import win32com.client
    disp = pythoncom.CoGetInterfaceAndReleaseStream(stream, pythoncom.IID_IDispatch)
    return win32com.client.Dispatch(disp)


def _group_sheets(g):
    """묶음이 건드리는 시트명(등장 순서 유지, 중복 제거)."""
    seen = []
    for s in g["steps"]:
        sh = s.target.sheet if s.target else ""
        if sh and sh not in seen:
            seen.append(sh)
    return seen


def _group_title(g):
    """카드 제목 — 역할 + 대상 시트 + 스텝 수. "구조 변경 (5스텝)" 같은 무정보 제목 대신
    "구조 변경 — 요약 (5스텝)" 으로, 사용자가 카드만 보고 어디를 만지는지 알게 한다."""
    roles = g.get("roles") or [g["role"]]
    role_txt = "+".join(ROLE_TITLES.get(r, r) for r in roles)
    sheets = _group_sheets(g)
    where = ""
    if sheets:
        where = f" — {sheets[0]}" + (f" 외 {len(sheets) - 1}" if len(sheets) > 1 else "")
    return f"{role_txt}{where} ({len(g['steps'])}스텝)"


# ── 붙여넣기 통합(paste consolidation) ──────────────────────────────
# 큰 복사·붙여넣기가 copy_paste 로 인식되지 못하면(복사 소스 미대기·교차앱 등) 값이
# 조각난 리터럴 range_fill/cell_edit 여러 개로 캡처된다. 그러면 chunk_groups(40) 가
# 카드를 여러 장으로 쪼개고(사용성↓·대기↑·스킬 남발), 재현도 벌크 1회가 아니라 수십
# 번의 작은 write 가 된다. ctx.write 는 어차피 벌크(1 COM 호출)이므로, 연속된 같은
# (book,sheet) 리터럴 값 스텝을 하나의 bounding-box write 로 합치면 '붙여넣기 = 스킬 1개
# + 벌크 1회'가 된다. 결정론이라 재현 안정(LLM 생성 아님, Docs/05 §5.4 철학과 동일).

PASTE_MERGE_MIN_RUN = 4        # 이 개수 이상 연속돼야 통합(짧은 타이핑은 그대로 둠)
PASTE_MERGE_MAX_CELLS = 200_000  # 완전박스 통합의 바운딩박스 상한(저사양 보호)


def _literal_cells(step):
    """리터럴 값 스텝이면 {(row,col): value} 로 펼쳐 반환, 아니면 None."""
    if step.kind not in (RANGE_FILL, CELL_EDIT):
        return None
    p = step.payload or {}
    if p.get("mode") == "formula":
        return None
    grid = p.get("values")
    if grid is None or not step.target:
        return None
    parsed = a1.parse_range(step.target.range)
    if not parsed:
        return None
    (r1, c1), _ = parsed
    cells = {}
    for i, row in enumerate(grid if isinstance(grid, (list, tuple)) else [[grid]]):
        row = row if isinstance(row, (list, tuple)) else [row]
        for j, v in enumerate(row):
            cells[(r1 + i, c1 + j)] = v
    return cells


def _fill_step(merged, book, sheet, r1, c1, r2, c2, step_id, desc):
    """merged[(r,c)] 값으로 (r1,c1)-(r2,c2) 박스를 채운 단일 range_fill Step."""
    grid = [[merged.get((r1 + a, c1 + b)) for b in range(c2 - c1 + 1)]
            for a in range(r2 - r1 + 1)]
    rng = a1.make_range((r1, c1), (r2, c2))
    return Step(step_id, RANGE_FILL, target=Target(book, sheet, rng),
                payload={"mode": "value", "values": grid}, description=desc)


def _row_run_steps(merged, book, sheet, base_id):
    """gap 이 있는 런을 '행별 연속 구간(row-run)'으로 분할한 스텝 목록.

    각 행에서 실제로 건드린 열들만 연속 구간으로 묶어 range_fill 을 만든다. 건드리지
    않은(merged 에 없는) 좌표는 어떤 스텝에도 들어가지 않으므로 재현 때 덮이지 않는다."""
    steps = []
    k = 0
    for r in sorted({row for row, _ in merged}):
        cols = sorted(c for (rr, c) in merged if rr == r)
        seg_start = prev = None
        segs = []
        for c in cols:
            if seg_start is None:
                seg_start = prev = c
            elif c == prev + 1:
                prev = c
            else:
                segs.append((seg_start, prev))
                seg_start = prev = c
        if seg_start is not None:
            segs.append((seg_start, prev))
        for (cs, ce) in segs:
            steps.append(_fill_step(merged, book, sheet, r, cs, r, ce,
                                    f"{base_id}_{k}", f"블록 값 입력 {sheet}!{a1.make_range((r, cs), (r, ce))} (통합-분할)"))
            k += 1
    return steps


def _steps_to_transform(steps):
    """스텝 목록 → def transform(ctx) 코드(등가 게이트 대조용)."""
    lines = ["def transform(ctx):"]
    for s in steps:
        lines.extend(step_to_lines(s))
    return "\n".join(lines) + "\n"


def consolidate_literal_runs(steps, min_run=PASTE_MERGE_MIN_RUN,
                             max_cells=PASTE_MERGE_MAX_CELLS):
    """연속된 같은 (book,sheet) 리터럴 값 스텝 런을 더 적은 range_fill 로 통합.

    큰 붙여넣기가 조각으로 캡처돼도 카드 수·벌크 write 호출을 줄인다. 순서 보존: 구조/
    서식/수식/다른 시트 스텝을 만나면 런을 끊는다. **gap 안전**: 박스에 빈 좌표가 있으면
    None 으로 덮지 않고(=기존 데이터 보존) 행별 연속구간으로 분할한다. 채택 전 '건드린
    셀' 등가 게이트로 자기검증 — 원본과 다르게 건드리면 통합을 버리고 원본 유지."""
    out = []
    i, n = 0, len(steps)
    while i < n:
        s = steps[i]
        cells0 = _literal_cells(s)
        if cells0 is None:
            out.append(s)
            i += 1
            continue
        book = s.target.book
        sheet = s.target.sheet
        run = [s]
        merged = dict(cells0)
        j = i + 1
        while j < n:
            t = steps[j]
            if not t.target or t.target.book != book or t.target.sheet != sheet:
                break
            c = _literal_cells(t)
            if c is None:
                break
            merged.update(c)  # 겹치면 뒤 스텝 우선(붙여넣기는 안 겹침)
            run.append(t)
            j += 1
        new_steps = None
        if len(run) >= min_run:
            rs = [r for r, _ in merged]
            cs = [c for _, c in merged]
            r1, r2, c1, c2 = min(rs), max(rs), min(cs), max(cs)
            area = (r2 - r1 + 1) * (c2 - c1 + 1)
            if len(merged) == area and area <= max_cells:
                # (a) 빈칸 없는 완전 박스 → 단일 range_fill(진짜 붙여넣기 대부분 여기)
                new_steps = [_fill_step(merged, book, sheet, r1, c1, r2, c2, run[0].id,
                                        f"블록 값 입력/붙여넣기 {sheet}!{a1.make_range((r1, c1), (r2, c2))} ({len(run)}스텝 통합)")]
            else:
                # (b) 빈 좌표 있음 → 행별 연속구간 분할(gap 미포함 → 덮어쓰기 없음)
                new_steps = _row_run_steps(merged, book, sheet, run[0].id)
        # (c) 이득 없으면(분할 결과 ≥ 원본) 통합하지 않는다.
        if new_steps is not None and len(new_steps) < len(run):
            # 회귀 안전망: '건드린 셀'까지 원본과 완전 동일할 때만 채택.
            accept = True
            try:
                from ixicellr.replay.equivalence import touched_equivalent
                accept = touched_equivalent(_steps_to_transform(run), _steps_to_transform(new_steps))
            except Exception:
                accept = False
            if accept:
                out.extend(new_steps)
                i = j
                continue
            from ixicellr.runtime import log
            log.info(f"paste 통합 게이트 거부 — 원본 유지 ({sheet}, {len(run)}스텝)")
        out.append(s)
        i += 1
    return out


def _format_payload(step):
    """FORMAT 스텝의 서식 dict(payload['format']) 반환, 아니면 None."""
    if step.kind != "format" or not step.target:
        return None
    p = step.payload or {}
    fmt = p.get("format")
    return fmt if isinstance(fmt, dict) else None


def _format_unionable(fmt):
    """이 서식이 여러 영역을 union 주소 한 번에 적용해도 안전한가.

    테두리/병합은 다중영역 적용 시 변(邊) 해석·좌상단 파괴가 영역별로 달라 위험 —
    snapshot.group_changes 의 unionable 판정과 동일 규칙(회귀 안전)."""
    return not (fmt.get("borders") or fmt.get("merge") or fmt.get("merge_area"))


def consolidate_format_runs(steps):
    """연속된 같은 (book,sheet) FORMAT 스텝 중 '서식이 완전히 같은' 것을 union 주소
    한 스텝으로 합친다(테두리/병합 없는 안전한 서식만).

    서식 폭발(카드 과발생)의 상류 완화 — group_changes 가 시트 단위로 이미 union 하지만,
    증분(_fmt_live)+정지 스냅샷+reconcile 이 같은 서식을 별도 스텝으로 남기는 경우가 있어
    스텝 단위에서 한 번 더 결정론적으로 통합한다. 순서 보존: 다른 종류/시트/서식을 만나면
    런을 끊는다. 테두리/병합 서식은 절대 합치지 않는다(값 소실·변 해석 위험)."""
    from ixicellr.model.action_ir import FORMAT
    out = []
    i, n = 0, len(steps)
    while i < n:
        s = steps[i]
        fmt = _format_payload(s)
        if fmt is None or not _format_unionable(fmt):
            out.append(s)
            i += 1
            continue
        book, sheet = s.target.book, s.target.sheet
        key = _freeze_fmt(fmt)
        ranges = [s.target.range]
        j = i + 1
        while j < n:
            t = steps[j]
            tf = _format_payload(t)
            if (tf is None or not _format_unionable(tf)
                    or t.target.book != book or t.target.sheet != sheet
                    or _freeze_fmt(tf) != key):
                break
            if t.target.range not in ranges:
                ranges.append(t.target.range)
            j += 1
        if len(ranges) > 1:
            # union 주소 덩어리로 합친다(주소 문자열 길이 상한 준수 — Range() 255자 한계).
            for chunk in _union_addr_chunks(ranges):
                out.append(Step(s.id, FORMAT, target=Target(book, sheet, chunk),
                                payload={"format": fmt},
                                description=f"서식(통합): {sheet}!{chunk[:40]}"))
            i = j
        else:
            out.append(s)
            i += 1
    return out


def _freeze_fmt(fmt):
    """서식 dict 를 비교 가능한 정렬 키로(중첩 dict/list 포함)."""
    if isinstance(fmt, dict):
        return tuple(sorted((str(k), _freeze_fmt(v)) for k, v in fmt.items()))
    if isinstance(fmt, (list, tuple)):
        return tuple(_freeze_fmt(x) for x in fmt)
    return fmt


def _union_addr_chunks(ranges, max_chars=200):
    """주소 목록을 union 문자열 덩어리로(snapshot.UNION_ADDR_MAX_CHARS 와 같은 상한)."""
    chunks, cur = [], ""
    for r in ranges:
        cand = f"{cur},{r}" if cur else r
        if len(cand) > max_chars and cur:
            chunks.append(cur)
            cur = r
        else:
            cur = cand
    if cur:
        chunks.append(cur)
    return chunks


def group_steps(steps):
    """distill 결과를 역할(role) 경계로 묶는다(결정론 — LLM 그룹핑 전 단계).

    연속 스텝의 (role, book) 이 같으면 한 묶음. 시트 추가/삭제 같은 구조 스텝은
    앞뒤 흐름의 경계가 되는 일이 많아 role 변화로 자연히 끊긴다.
    반환: [{"role", "roles", "title", "steps": [Step...], "hazards": {code: [id...]}}]
    """
    groups = []
    cur = None
    for s in steps:
        si = analyze_step(s)
        book = s.target.book if s.target else ""
        key = (si.role, book)
        if cur is None or cur["_key"] != key:
            cur = {"_key": key, "role": si.role, "roles": [si.role],
                   "steps": [], "hazards": {}, "_book": book}
            groups.append(cur)
        cur["steps"].append(s)
        for h in si.hazards:
            cur["hazards"].setdefault(h, []).append(s.id)
    for g in groups:
        del g["_key"]
        g["title"] = _group_title(g)
    return groups


def merge_small_adjacent_groups(groups, small=2, limit=40):
    """같은 워크북의 이웃 묶음 중 한쪽이 소묶음(≤small 스텝)이면 흡수한다(순서 불변).

    role 경계로만 끊으면 값 입력 사이에 낀 서식 1스텝 같은 것이 카드를 3장으로 쪼갠다
    (파편화 → 카드 수↑, 실행 호출 수↑, 사용자가 읽을 것↑). 실행 코드는 어차피 스텝
    순서대로 일렬이므로, 소묶음을 이웃과 합쳐도 재현 순서는 그대로다. 합계가
    limit(COM 예산 분할 단위)를 넘는 병합은 하지 않는다."""
    if not groups:
        return groups
    out = [dict(groups[0], roles=list(groups[0].get("roles") or [groups[0]["role"]]))]
    for g in groups[1:]:
        prev = out[-1]
        same_book = prev.get("_book", "") == g.get("_book", "")
        tiny = len(prev["steps"]) <= small or len(g["steps"]) <= small
        # 소묶음 흡수 후엔 같은 role 묶음이 이웃할 수 있다(값→서식1→값 샌드위치에서
        # 서식을 흡수하면 값 묶음 둘이 이어짐) — 이어붙여 파편화를 마저 없앤다.
        rejoin = g["role"] == prev["role"]
        fits = len(prev["steps"]) + len(g["steps"]) <= limit
        if same_book and (tiny or rejoin) and fits:
            prev["steps"] = prev["steps"] + list(g["steps"])
            for code, ids in g["hazards"].items():
                prev["hazards"].setdefault(code, []).extend(ids)
            for r in (g.get("roles") or [g["role"]]):
                if r not in prev["roles"]:
                    prev["roles"].append(r)
            # 대표 role 은 스텝이 더 많은 쪽 유지(제목·아이콘 근거)
            continue
        out.append(dict(g, roles=list(g.get("roles") or [g["role"]])))
    for g in out:
        g["title"] = _group_title(g)
    return out


def chunk_groups(groups, limit=40):
    """스텝이 많은 묶음을 limit 이하로 쪼갠다.

    한 묶음 = 파이프라인 스텝 1개 = /api/excel/run-python 1회 실행인데, 실행기의
    COM 호출 예산(PY_COM_BUDGET=400)이 있어 수백 스텝짜리 묶음(서식 몰아치기 등)은
    통째로 실패한다. 쪼개면 각 스텝이 자기 예산 안에서 돈다."""
    out = []
    for g in groups:
        steps = g["steps"]
        if len(steps) <= limit:
            out.append(g)
            continue
        for j in range(0, len(steps), limit):
            sub = steps[j:j + limit]
            ids = {s.id for s in sub}
            hazards = {}
            for code, sids in g["hazards"].items():
                kept = [i for i in sids if i in ids]
                if kept:
                    hazards[code] = kept
            out.append({
                "role": g["role"],
                "steps": sub,
                "hazards": hazards,
                "title": f"{ROLE_TITLES.get(g['role'], g['role'])} ({j + 1}~{j + len(sub)}/{len(steps)}스텝)",
            })
    return out


def _body_has_statement(body):
    """body 라인 중 '실제 실행문'이 하나라도 있는지. 주석(#)·빈 줄만 있으면 False.

    미지원 액션(comment_set·hyperlink 등)이나 '(건너뜀)' 노트는 step_to_lines 가 주석
    라인만 돌려주는데, 그것만으로 채워진 def transform 은 'expected an indented block'
    파이썬 문법 오류가 난다(사용자: 재현 시 가져온 스킬 오류). 이 판정으로 pass 를 보강한다."""
    for ln in body:
        s = str(ln).strip()
        if s and not s.startswith("#"):
            return True
    return False


def group_to_pipeline_entry(group, index):
    """묶음 하나 → B2B 파이프라인 스텝 dict (프론트 normalizeStep 이 소화하는 형태)."""
    lines = ["def transform(ctx):"]
    body = []
    for s in group["steps"]:
        body.extend(step_to_lines(s))
    if not _body_has_statement(body):
        # 실행문이 없으면(전부 미지원/주석) 문법 오류 방지 위해 pass 를 넣는다.
        # 주석은 보존해 무엇이 재현 안 됐는지 남긴다.
        body = body + ["    pass"]
    lines.extend(body)
    descs = [s.description for s in group["steps"] if s.description]
    desc = " → ".join(descs[:3]) + (f" 외 {len(descs) - 3}건" if len(descs) > 3 else "")
    hazard_lines = [HAZARD_LABELS.get(code, code) for code in group["hazards"]]
    # [재현 제외 가시화] step_to_lines 가 주석으로만 남긴 동작(미지원·건너뜀)은 재현에서
    # 조용히 빠진다 — 사용자가 모른 채 "결과가 다르다"로 이어지므로 ⚠ 로 노출한다.
    skipped = []
    for ln in body:
        s2 = str(ln).strip()
        if s2.startswith("#") and ("건너뜀" in s2 or "미지원" in s2):
            note = s2.lstrip("# ").strip()
            if note not in skipped:
                skipped.append(note)
    if skipped:
        head = "; ".join(n[:60] for n in skipped[:2])
        hazard_lines.append(
            f"재현 제외 {len(skipped)}건 — {head}" + (" 외" if len(skipped) > 2 else ""))
    return {
        "id": f"rec_{int(time.time() * 1000)}_{index}",
        "language": "python",
        "code": "\n".join(lines) + "\n",
        "title": group["title"],
        "description": desc or group["title"],
        "enabled": True,
        "prompt": f"[녹화됨] {group['title']}: {desc}",
        "recorded": True,
        "role": group["role"],
        "hazards": hazard_lines,
        # 녹화 원시 스텝 수 — 클라 LLM 재그룹핑이 chunk_groups 의 COM 예산 분할(40)을
        # 도로 합쳐 예산 초과(중간 실패→부분 적용)를 만들지 않게 병합 한도 판단에 쓴다.
        "stepCount": len(group["steps"]),
        # 대상 시트 목록 — LLM 의도 그룹핑의 근거·검토 카드 표시용.
        "sheets": _group_sheets(group),
    }


class RecordService:
    """녹화 세션 1개(동시 녹화 없음). start → (사용자 작업) → stop → 파이프라인 스텝."""

    def __init__(self):
        self._lock = threading.Lock()
        self._thread = None
        self._stop_evt = threading.Event()
        self._sink = None
        self._handler = None
        self._result = None
        self._error = None
        self._recording = False

    def set_replaying(self, value):
        """B2B Excel 워커가 잡 실행 전/후 호출 — 녹화 중이면 B2B 자신의 변경을
        캡처하지 않도록 replaying 플래그를 토글한다. 녹화 중이 아니거나 정지
        시퀀스 진행 중(stop_evt)이면 no-op(정지 시퀀스의 replaying=True 보존)."""
        with self._lock:
            handler = self._handler if self._recording else None
        if handler is None or self._stop_evt.is_set():
            return
        try:
            handler.replaying = bool(value)
        except Exception:
            pass

    # ---- 상태 ----
    def status(self):
        with self._lock:
            n = len(self._sink.actions) if self._sink else 0
            strong = len(self._sink.strong()) if self._sink else 0
            return {"recording": self._recording, "actions": n, "meaningful": strong,
                    "error": self._error}

    # ---- 시작 ----
    def start(self, app_stream=None):
        with self._lock:
            if self._recording:
                raise RuntimeError("이미 녹화 중입니다.")
            self._stop_evt.clear()
            self._result = None
            self._error = None
            self._recording = True
        self._thread = threading.Thread(
            target=self._run, args=(app_stream,), daemon=True, name="b2b-recorder")
        self._thread.start()
        return True

    # ---- 정지 ----
    def stop(self, timeout=120.0):
        """정지 신호 후 결과 대기. 반환: {"steps": [...], "raw_actions": n, ...}"""
        with self._lock:
            if not self._recording and self._result is None and self._error is None:
                raise RuntimeError("녹화 중이 아닙니다.")
        self._stop_evt.set()
        if self._thread is not None:
            self._thread.join(timeout)
        with self._lock:
            if self._error:
                raise RuntimeError(self._error)
            if self._result is None:
                raise RuntimeError("녹화 정지 시간 초과(정지 시 스냅샷 diff 진행 중일 수 있음).")
            return self._result

    # ---- 녹화 스레드 본체 ----
    def _run(self, app_stream):
        import pythoncom
        pythoncom.CoInitialize()
        try:
            import win32com.client
            from ixicellr.recorder.com_events import AppEvents
            from ixicellr.recorder.copypaste_capture import CopySourceWatcher
            from ixicellr.recorder.sink import ActionSink
            from ixicellr.workbooks.registry import WorkbookRegistry

            if app_stream is not None:
                app = _unmarshal_app(app_stream)
                _app_via = "marshal"
            else:
                app = win32com.client.GetActiveObject("Excel.Application")
                _app_via = "getactive"
            try:
                _books = [str(w.Name) for w in app.Workbooks]
            except Exception:
                _books = None
            _trace("record.svc.begin", via=_app_via, books=_books)

            registry = WorkbookRegistry()
            sink = ActionSink()
            with self._lock:
                self._sink = sink
            for wb in app.Workbooks:
                registry.register(wb)

            handler = win32com.client.WithEvents(app, AppEvents)
            handler.sink = sink
            handler.registry = registry
            handler.copy_watcher = CopySourceWatcher()
            handler.replaying = False
            handler.begin(app)
            handler.capturing = True
            with self._lock:
                self._handler = handler

            # 펌프 루프 (control_panel._pump 미러: 메시지 펌프 + 복사 폴 + 증분 서식)
            sleep_s = C.PUMP_SLEEP_MS / 1000.0
            tick = 0
            while not self._stop_evt.is_set():
                pythoncom.PumpWaitingMessages()
                try:
                    handler.copy_watcher.poll(app, registry)
                except Exception:
                    pass
                tick += 1
                if tick % max(C.FMT_FLUSH_INTERVAL_TICKS, 1) == 0:
                    try:
                        handler.flush_dirty_formats(app)
                    except Exception:
                        pass
                try:
                    _ = app.Workbooks.Count  # Excel 종료 감지
                except Exception as _dead:
                    # 여기서 빠져나오면 그 뒤 수확은 전부 빈손이다. 예전에 '첫 녹화부터 캡처 0건'
                    # 제보의 실제 원인이 이 자리였는데 로그가 없어 한참 헤맸다.
                    _trace("record.svc.excel_gone", ticks=tick,
                           actions=len(getattr(sink, "actions", []) or []), error=str(_dead)[:200])
                    break
                time.sleep(sleep_s)

            # 정지 시퀀스 — ixi-Cell-R cli.py 순서 그대로
            handler.capturing = False
            handler.replaying = True
            # 이 7단계는 각각 try/except pass 라, 하나가 죽어도 결과만 조용히 비게 된다.
            # 어느 단계가 왜 죽었는지 남긴다(순서는 그대로 — ixi-Cell-R cli.py 검증된 순서).
            _phase_fail = {}
            for fn in ("flush_dirty_formats", "resolve_deferred", "capture_sort_diffs",
                       "capture_filter_diffs", "capture_dimension_diffs",
                       "capture_format_diffs", "capture_object_diffs"):
                try:
                    getattr(handler, fn)(app)
                except Exception as _pe:
                    _phase_fail[fn] = str(_pe)[:160]
            try:
                handler.reconcile()
            except Exception as _re:
                _phase_fail["reconcile"] = str(_re)[:160]
            if _phase_fail:
                _trace("record.svc.stop_phase_failed", phases=sorted(_phase_fail),
                       detail=_phase_fail, actions=len(sink.actions))

            _n_raw = len(sink.actions)
            steps = distill(sink.actions)
            # 조각난 붙여넣기(리터럴 값 런) 통합 + 서식 폭발 사전통합(안전 subset)
            #   → 역할 그룹핑 → 소묶음 흡수 → COM 예산 분할(40)
            # 서식 사전통합은 카드 과발생(D)의 상류 완화 — 테두리/병합은 절대 안 합침.
            _n_distilled = len(steps)
            steps = consolidate_literal_runs(steps)
            _n_lit = len(steps)
            steps = consolidate_format_runs(steps)
            _n_fmt = len(steps)
            groups = chunk_groups(merge_small_adjacent_groups(group_steps(steps)))
            entries = [group_to_pipeline_entry(g, i) for i, g in enumerate(groups)]
            _n_before_noop = len(entries)
            # [no-op 그룹 제거] 재현 효과가 없는(ctx 호출 없이 주석/pass 뿐인) 그룹은 스텝으로
            # 만들지 않는다. comment_set·hyperlink 등 미지원 액션만 모인 그룹이 그런 경우인데,
            # 실행하면 '워크북 변경 없음'으로 서버가 실패(400) 처리해 재현 전체가 깨졌다.
            entries = [e for e in entries if "ctx." in (e.get("code") or "")]
            # 어디서 몇 개가 줄었는지 한 줄로 — '캡처 0건' 이 나왔을 때 어느 단계에서 사라졌는지
            # 이 줄 하나로 가른다(조작은 했는데 raw 가 0 이면 수집 실패, raw 는 있는데 entries 가
            # 0 이면 정제·그룹핑 쪽 문제).
            _trace("record.svc.harvest",
                   rawActions=_n_raw, distilled=_n_distilled,
                   afterLiteralMerge=_n_lit, afterFormatMerge=_n_fmt,
                   groups=len(groups), entries=_n_before_noop,
                   droppedNoop=_n_before_noop - len(entries), finalSteps=len(entries))
            # [재현 검증] 정지 시점 = 사용자가 만든 '정답' 상태. 건드린 시트의 다이제스트를
            # 남겨 재현 후 자동 대조한다(실패해도 녹화 결과는 그대로 — best effort).
            try:
                expected = capture_expected_states(app, getattr(handler, "_touched_sheets", set()))
            except Exception as _ee:
                expected = []
                # 재현 후 자동 대조가 통째로 꺼진다 — 실패해도 녹화는 살리되 사실은 남긴다.
                _trace("record.svc.expected_failed", error=str(_ee)[:200],
                       touched=len(getattr(handler, "_touched_sheets", set()) or ()))
            with self._lock:
                self._result = {
                    "steps": entries,
                    "raw_actions": len(sink.actions),
                    "distilled": len(steps),
                    "groups": len(groups),
                    "expected": expected,
                }
        except Exception as _fatal:
            # 예전엔 self._error 에만 담겨, 사용자가 화면 문구를 옮겨 적지 않으면 원인을 몰랐다.
            _trace("record.svc.error", error=str(_fatal)[:200],
                   trace=traceback.format_exc(limit=4)[-500:])
            with self._lock:
                self._error = traceback.format_exc(limit=8)
        finally:
            with self._lock:
                self._recording = False
                self._handler = None
            pythoncom.CoUninitialize()


RECORD_SERVICE = RecordService()

"""복사→붙여넣기 / 셀삭제 캡처 (Docs/04 §4.5, Docs/07 §7.5, Docs/10 §10.4).

COM 에는 Paste 이벤트가 없다. CutCopyMode 전이 때 소스를 스냅샷하고, 사용자가
붙여넣은 직후 명시 트리거로 target↔source 를 매칭한다. 순수 로직(스냅샷 전이 판정,
액션 빌드, 검증)은 COM 무관 → 테스트 가능.
"""
from __future__ import annotations

from ..model import a1
from ..model.action_ir import CLEAR, COPY_PASTE, SORT, Action, Target


def is_fresh_copy(prev_active: bool, mode) -> bool:
    """비활성→활성 전이일 때만 새 복사로 본다(Ctrl+C 순간)."""
    return bool(mode) and not prev_active


def _norm(addr: str) -> str:
    return str(addr).replace("$", "")


def _dims(rng_str: str):
    parsed = a1.parse_range(rng_str)
    if not parsed:
        return None
    (r1, c1), (r2, c2) = parsed
    return (r2 - r1 + 1, c2 - c1 + 1)


def validate_capture(source: dict | None, target_range: str):
    """복붙 캡처 유효성 (오캡처 방지, Docs/04 §4.5)."""
    if not source:
        return False, "복사 소스 없음 — 붙여넣기 직후 캡처하세요"
    if "," in (target_range or ""):
        return False, "비연속 다중영역 타깃 거부"
    if "," in (source.get("range") or ""):
        return False, "비연속 다중영역 소스 거부"
    td = _dims(target_range)
    sd = _dims(source.get("range", ""))
    # 타깃이 단일 셀이면 소스 크기로 자동 확장 OK. 다중 셀이면 크기 일치해야.
    if td and sd and td != (1, 1) and td != sd:
        return False, f"소스{sd}와 타깃{td} 크기 불일치"
    return True, ""


def build_copy_paste_action(seq: int, source: dict, target: Target, mode: str = "all") -> Action:
    # 소스 값 스냅샷은 payload 최상위 paste_values 로(재현 결정성). source dict 안에 두면
    # to_steps 의 Target.from_dict 가 book/sheet/range 만 남기고 버린다.
    src_no_vals = {k: v for k, v in source.items() if k != "values"}
    payload = {"mode": mode, "source": src_no_vals}
    if source.get("values") is not None:
        payload["paste_values"] = source["values"]
    return Action(seq, COPY_PASTE, target, payload=payload, evidence={"capture": "copypaste"})


def build_clear_action(seq: int, target: Target) -> Action:
    return Action(seq, CLEAR, target, evidence={"capture": "clear"})


class CopySourceWatcher:
    """폴 주기마다 CutCopyMode 전이를 보고 소스를 스냅샷."""

    def __init__(self):
        self.prev_active = False
        self.last_source = None

    def poll(self, app, registry) -> None:
        try:
            mode = app.CutCopyMode  # 1=copy, 2=cut, 0/False=none
        except Exception:
            return
        if is_fresh_copy(self.prev_active, mode):
            self.last_source = self._read_source(app, registry, mode)
        self.prev_active = bool(mode)

    @staticmethod
    def _read_source(app, registry, mode) -> dict | None:
        try:
            sel = app.Selection
            wb = app.ActiveWorkbook
            src = {
                "book": registry.register(wb),
                "sheet": app.ActiveSheet.Name,
                "range": _norm(sel.Address),
                "cut": mode == 2,
            }
            # [재현 결정성] 복사 '시점'의 소스 값을 스냅샷한다. 재현은 워크북을 원본으로
            # 리셋한 뒤 스텝을 돌리는데, 사용자가 '녹화 중 만든 데이터'를 복사한 경우 원본엔
            # 그 값이 없어 paste_copied(소스 재읽기)가 빈값이 됐다(사용자: "텍스트가 안 채워짐").
            # 캡처값이 있으면 붙여넣기를 그 값으로 결정적으로 재현한다. 과대 선택은 생략.
            try:
                from ..runtime import constants as _C
                n = int(sel.Cells.Count)
                if 0 < n <= _C.COPY_VALUE_MAX_CELLS:
                    v = sel.Value
                    src["values"] = ([list(r) if isinstance(r, tuple) else [r] for r in v]
                                     if isinstance(v, tuple) else [[v]])
            except Exception:
                pass
            return src
        except Exception:
            return None


def _read_block_grid(app, book_key, sheet, anchor_cell, width, *, max_rows=2000):
    """앵커 아래 직사각형을 1회 벌크 read(의도 추정용). COM 얇게, 실패는 None."""
    from ..model import a1
    parsed = a1.parse_cell(anchor_cell.replace("$", ""))
    if not parsed:
        return None
    r0, c0 = parsed
    try:
        for wb in app.Workbooks:
            try:
                from ..workbooks.registry import basename_of, normalize_book_name
                fn = basename_of(normalize_book_name(wb.FullName))
            except Exception:
                fn = None
            if fn == basename_of(book_key) or getattr(wb, "Name", None) == book_key:
                ws = wb.Worksheets(sheet)
                end_r = ws.Cells(r0, c0).End(-4121).Row  # xlDown
                last_r = min(max(int(end_r), r0), r0 + max_rows - 1)
                rng = ws.Range(ws.Cells(r0, c0), ws.Cells(last_r, c0 + width - 1))
                v = rng.Value
                if isinstance(v, tuple):
                    return [list(r) if isinstance(r, tuple) else [r] for r in v]
                return [[v]]
    except Exception:
        return None
    return None


def infer_source_intent(app, action):
    """캡처된 복붙의 소스 범위가 어떤 '동적 의도'와 일치하는지 추정해 evidence 에 부착.

    '자동 추정 + 사람 확인'(사용자 선택): 여기선 후보만 계산하고, 확정(승격)은 UI 가
    사용자 확인을 받아 payload['source_spec'] 으로 한다. COM 실패해도 캡처는 유지."""
    from ..model import a1
    from ..model.rangespec import infer_candidates
    src = action.payload.get("source")
    if not src:
        return action
    parsed = a1.parse_range((src.get("range") or "").replace("$", ""))
    if not parsed:
        return action
    (r1, c1), (r2, c2) = parsed
    width = c2 - c1 + 1
    multi_row = (r2 - r1 + 1) > 1
    anchor = a1.make_cell(r1, c1)
    grid = _read_block_grid(app, src["book"], src["sheet"], anchor, width)
    cands = infer_candidates(src["range"], grid, key_col=1) if grid else ["fixed"]
    # 다중 행 복사면(의도가 '행'에 있을 가능성) 항상 후보를 부착해 UI 가 확인하게 한다.
    # top_n/visible_only 는 우연일치로 추정 불가하므로 다중행이면 메뉴로 제공.
    if multi_row or len(cands) > 1:
        action.evidence["spec_candidates"] = cands
        action.evidence["spec_anchor"] = anchor
        action.evidence["spec_width"] = width
        action.evidence["spec_rows"] = r2 - r1 + 1
    return action


def capture_copypaste(app, watcher: "CopySourceWatcher", sink, registry, mode: str = "all"):
    """붙여넣기 직후 호출 — 현재 Selection 을 타깃으로 source 와 매칭."""
    source = watcher.last_source
    try:
        sel = app.Selection
        target = Target(registry.register(app.ActiveWorkbook), app.ActiveSheet.Name, _norm(sel.Address))
    except Exception as e:
        return None, f"타깃 읽기 실패: {e}"
    ok, reason = validate_capture(source, target.range)
    if not ok:
        return None, reason
    a = build_copy_paste_action(sink._seq + 1, source, target, mode)
    try:
        infer_source_intent(app, a)  # 의도 후보 부착(실패해도 캡처 유지)
    except Exception:
        pass
    sink.actions.append(a)
    sink._seq += 1
    return a, ""


def capture_clear(app, sink, registry):
    """현재 선택 범위를 '비우기' 단계로 캡처(Delete 안 눌러도 OK)."""
    try:
        sel = app.Selection
        target = Target(registry.register(app.ActiveWorkbook), app.ActiveSheet.Name, _norm(sel.Address))
    except Exception as e:
        return None, f"선택 읽기 실패: {e}"
    a = build_clear_action(sink._seq + 1, target)
    sink.actions.append(a)
    sink._seq += 1
    return a, ""


def capture_sort(app, sink, registry):
    """현재 시트의 '마지막 정렬'을 캡처(Excel ws.Sort 상태). 정렬 직후 호출.

    내림차순/오름차순·키 열·범위를 읽어 SORT 액션으로. 재현 시 같은 정렬을 적용해,
    이후 그 결과를 참조하는 복붙/수식이 올바른 값을 가리키게 한다([Docs/04 §4.5]).
    """
    try:
        ws = app.ActiveSheet
        book = registry.register(app.ActiveWorkbook)
        srt = ws.Sort
        fields = srt.SortFields
        if fields.Count < 1:
            return None, "정렬 정보 없음 — 먼저 Excel에서 정렬한 뒤 누르세요"
        field = fields.Item(1)
        rng = srt.Rng
        rng_addr = _norm(rng.Address)
        key_col = int(field.Key.Column) - int(rng.Column) + 1  # 범위 내 1-based 키 열
        ascending = int(field.Order) == 1                      # xlAscending=1
        try:
            has_header = int(srt.Header) == 1                  # xlYes=1
        except Exception:
            has_header = True
    except Exception as e:
        return None, f"정렬 캡처 실패: {e}"
    payload = {"key_col": key_col, "ascending": ascending, "has_header": has_header}
    a = Action(sink._seq + 1, SORT, Target(book, ws.Name, rng_addr),
               payload=payload, evidence={"capture": "sort"})
    sink.actions.append(a)
    sink._seq += 1
    return a, ""

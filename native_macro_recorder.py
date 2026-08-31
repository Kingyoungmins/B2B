"""Excel 네이티브 매크로 레코더 기반 녹화 엔진 (VBA 청킹).

MS 매크로 기록기(리본 '매크로 기록')를 프로그램으로 토글해 사용자의 전체 행동을
Excel 이 직접 VBA 로 기록하게 하고, 정지 시 기록된 모듈을 추출·정제해
**스킬 1개(Sub B2BSkill)** 로 청킹한다. 재현은 B2B 의 기존 VBA 러너(격리 인스턴스)로.

기존 Python 이벤트 캡처(record_service.py) 대비:
  + 녹화 중 부하 ~0 (Excel 내부 C++ 기록 — 이벤트 펌프/스냅샷 diff 없음)
  + 재현 = Application.Run 1회 (COM 왕복이 스텝 수와 무관)
  + 자동필터/피벗/차트 등 MS 가 지원하는 모든 동작을 충실히 기록
  - 절대참조/Select 기반이라 다른 파일 적응은 LLM 수정에 의존
  - 레코더 토글이 비공식(ExecuteMso + Win32 다이얼로그 확인) → 실패 시 명확한 안내 에러

주의: 레코더 시작(ExecuteMso "MacroRecord")은 '매크로 기록' 다이얼로그를 띄운다.
포커스 무관 Win32 워커(PostMessage Enter)가 기본값(Macro1·현재 통합 문서)으로 자동 확인한다.
(SendKeys 보조는 NumLock 뒤집기 버그 + 잔류 키 재생 위험으로 제거 — 실측.)
매크로 추출은 VBProject 접근('VBA 프로젝트 개체 모델 신뢰') 필요 — B2B VBA 러너와
동일 전제라 추가 요구는 아니다.
"""
from __future__ import annotations

import re

VBEXT_CT_STDMODULE = 1  # 표준 모듈

# MS 매크로 기록 리본 컨트롤의 정본 idMso. '매크로 기록'과 '기록 중지'가 같은
# 컨트롤(토글 버튼 아님 — 일반 버튼)이라 시작/정지 모두 이 id 로 ExecuteMso 한다.
# (주의: "MacroRecording" 은 존재하지 않는 idMso → ExecuteMso/Get*Mso 가
#  0x80070057 E_INVALIDARG 예외. 실측으로 "MacroRecord" 가 유효함을 확인.)
_MACRO_RECORD_IDMSO = "MacroRecord"
# '상대 참조로 기록' 리본 토글. Application.RecordRelative 는 읽기전용이라(실측)
# 켜져 있으면 이 토글로 꺼서 '절대 셀 주소 기록'을 강제한다.
_MACRO_RELATIVE_IDMSO = "MacroRelativeReferences"
# 녹화 중이면 이 버튼 라벨이 '기록 중지'/'Stop Recording' 로 바뀐다(로캘 의존).
_RECORDING_LABEL_HINTS = ("중지", "stop")


# ── 순수 함수: 기록 VBA 정제 (테스트 가능) ─────────────────────────

_NOISE_LINE = re.compile(
    r"^\s*(?:ActiveWindow\.(?:SmallScroll|ScrollRow|ScrollColumn|ScrollWorkbookTabs)\b"
    r"|Application\.Goto\b.*Scroll:=)", re.I)
_SELECT_LINE = re.compile(r"^(\s*)(.+?)\.Select\s*$")
_SELECTION_LINE = re.compile(r"^\s*Selection(\.[^=\s].*)$")
_SUB_HEADER = re.compile(r"^\s*Sub\s+\w+\s*\(\s*\)\s*$", re.I)
_SUB_END = re.compile(r"^\s*End\s+Sub\s*$", re.I)
_COMMENT_ONLY = re.compile(r"^\s*'")
_SHEETY = re.compile(r"(?:Sheets|Worksheets)\s*\(", re.I)


def extract_macro_body(module_code: str) -> str:
    """모듈 코드에서 첫 Sub 의 본문만 (헤더/End Sub/주석 제거)."""
    body, inside = [], False
    for line in str(module_code or "").splitlines():
        if not inside:
            if _SUB_HEADER.match(line):
                inside = True
            continue
        if _SUB_END.match(line):
            break
        if _COMMENT_ONLY.match(line):
            continue
        body.append(line.rstrip())
    return "\n".join(body).strip("\n")


# [죽은 타이핑 중간산물] 수식 자동완성 중 확정 전 상태가 같은 셀에 두 번 기록된다
# (실측: W1 에 ="=SUM" 후 곧바로 ="=SUM(RC[-2]:RC[-1])", L1 에 ="=su" 후 완성 수식).
# 앞의 미완성 대입은 재생 노이즈(#NAME?)이고, 분할 LLM 이 이 죽은 줄을 버리면
# 데이터보존 검증(b)이 분할 전체를 폐기한다 → 레코더에서 결정론적으로 제거.
_ACTIVECELL_ASSIGN = re.compile(r"^\s*ActiveCell\.(?:Formula2?R1C1|Formula2?|Value2?)\s*=", re.I)
_SINGLE_CELL_SELECT = re.compile(r'^\s*Range\("(\$?[A-Z]{1,3}\$?\d+)"\)\.Select\s*$', re.I)
_CUTCOPY_OFF = re.compile(r"^\s*Application\.CutCopyMode\s*=\s*False\s*$", re.I)


def _drop_dead_typing_lines(lines):
    """같은 선택 셀에 연속 대입 시(사이에 같은 셀 재선택/CutCopyMode/빈 줄만 허용) 앞 대입을 버린다."""
    out = []
    cur_cell = None
    for idx, line in enumerate(lines):
        sel = _SINGLE_CELL_SELECT.match(line)
        if sel:
            cur_cell = sel.group(1).replace("$", "").upper()
            out.append(line)
            continue
        if _ACTIVECELL_ASSIGN.match(line) and cur_cell:
            # 앞으로 스캔: 선택 셀이 안 바뀐 채 또 ActiveCell 대입이 오면 이 줄은 죽은 중간산물.
            dead = False
            for nxt in lines[idx + 1:]:
                if not nxt.strip() or _CUTCOPY_OFF.match(nxt):
                    continue
                nsel = _SINGLE_CELL_SELECT.match(nxt)
                if nsel:
                    if nsel.group(1).replace("$", "").upper() == cur_cell:
                        continue  # 같은 셀 재선택 — 문맥 유지
                    break         # 다른 셀로 이동 — 이 대입은 확정본
                if _ACTIVECELL_ASSIGN.match(nxt):
                    dead = True   # 같은 셀에 재대입 — 앞 대입 폐기
                break             # 그 외 동작이 끼면 보수적으로 보존
            if dead:
                continue
        elif not _SINGLE_CELL_SELECT.match(line) and _SELECT_LINE.match(line):
            cur_cell = None  # 범위/열/시트 등 다른 Select — 단일 셀 추적 해제
        out.append(line)
    return out


def sanitize_recorded_vba(body: str) -> str:
    """기록 VBA 의 재생 노이즈 제거 + Select/Selection 쌍 접합.

    - 스크롤 줄 제거(화면 이동은 행동이 아님)
    - 죽은 타이핑 중간산물 제거(같은 셀 연속 대입의 앞 대입 — 수식 자동완성 잔재)
    - `<범위>.Select` 바로 뒤 `Selection.X` → `<범위>.X` 로 접합(화면 갱신·활성화 왕복 제거).
      시트 Select(Sheets(...).Select)와 ActiveCell 쌍은 실행 의미가 있어 보존한다.
    - 연속 빈 줄 정리
    결정론 텍스트 변환만 — 동작 의미를 바꾸는 재작성은 하지 않는다(LLM 아님).
    """
    lines = [l for l in str(body or "").splitlines() if not _NOISE_LINE.match(l)]
    lines = _drop_dead_typing_lines(lines)
    out = []
    i = 0
    while i < len(lines):
        cur = lines[i]
        m = _SELECT_LINE.match(cur)
        if m and not _SHEETY.search(m.group(2)):
            indent, target = m.group(1), m.group(2).strip()
            j = i + 1
            fused = []
            used_active_cell = False
            while j < len(lines):
                sm = _SELECTION_LINE.match(lines[j])
                if sm:
                    fused.append(f"{indent}{target}{sm.group(1).strip()}")
                    j += 1
                    continue
                if re.match(r"^\s*ActiveCell\b", lines[j]):
                    used_active_cell = True
                break
            if fused and not used_active_cell:
                out.extend(fused)
                i = j
                continue
        out.append(cur)
        i += 1
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip("\n")


# ── 동적 시트 참조 (절대참조 약점 보정) ──────────────────────────────
_SHEET_ADD_RE = re.compile(r"^\s*(?:Sheets|Worksheets)\.Add\b", re.I)
# 새 시트를 가리키는 절대 시트명 리터럴 후보 — 파일명(.xls*)은 제외.
_SHEET_LIT_RE = re.compile(
    r'(?:Sheets|Worksheets)\(\s*"([^"]+)"\s*\)'      # Sheets("X")
    r'|"([^"!]+)!',                                   # "X!..."  (시트!범위)
    re.I)


def rewrite_new_sheet_refs(body):
    """Sheets.Add 로 만든 새 시트를 이후 코드가 '고정 이름'(예: "Sheet1")으로 참조하는
    것을, 실행 시점의 실제 시트 이름을 담는 변수로 바꾼다.

    MS 레코더는 새 시트 이름을 하드코딩하는데 그 이름은 실행 환경마다 달라진다
    (output 에 Sheet1 유무에 따라 Sheet1↔Sheet2) → 피벗 SourceData/Destination·
    Sheets("Sheet1") 참조가 어긋나 재현 실패(PivotFields 오류). 절대참조가 약한
    '동적 시트명' 부분에 한해 동적 참조를 허용한다(다른 절대참조는 손대지 않음).

    변환: Add 다음 줄에 `B2B_NewSheetN = ActiveSheet.Name` 캡처를 삽입하고,
    그 새 시트명 리터럴을
      Sheets("X")            → Sheets(B2B_NewSheetN)
      Worksheets("X")        → Worksheets(B2B_NewSheetN)
      "X!R1C1:..."           → B2B_NewSheetN & "!R1C1:..."
    로 치환한다(그 Add 이후 구간에서만). 순수 텍스트 변환 — 값 의미는 안 바꾼다."""
    lines = str(body or "").splitlines()
    add_idx = [i for i, l in enumerate(lines) if _SHEET_ADD_RE.match(l)]
    if not add_idx:
        return body

    out = list(lines)
    inserted = 0
    for n, orig_i in enumerate(add_idx, start=1):
        i = orig_i + inserted
        var = "B2B_NewSheet%d" % n
        # Add 이후 구간에서 '이 새 시트를 가리키는 첫 시트명' 확정
        region = out[i + 1:]
        new_name = None
        for line in region:
            m = _SHEET_LIT_RE.search(line)
            if m:
                cand = m.group(1) or m.group(2)
                if cand and ".xls" not in cand.lower():
                    new_name = cand
                    break
        if not new_name:
            continue
        indent = re.match(r"^(\s*)", out[i]).group(1)
        out.insert(i + 1, "%s%s = ActiveSheet.Name" % (indent, var))
        inserted += 1
        esc = re.escape(new_name)
        for k in range(i + 2, len(out)):
            ln = out[k]
            if _SHEET_ADD_RE.match(ln):
                break  # 다음 Add 구간부터는 그 시트의 몫
            ln = re.sub(r'(Sheets|Worksheets)\(\s*"%s"\s*\)' % esc,
                        lambda mm: "%s(%s)" % (mm.group(1), var), ln, flags=re.I)
            ln = re.sub(r'"%s!' % esc, '%s & "!' % var, ln, flags=re.I)
            out[k] = ln
    return "\n".join(out)


def wrap_as_b2b_skill(body: str) -> str:
    indented = "\n".join(
        ("    " + l if l.strip() else "") for l in str(body or "").splitlines())
    return ("Sub B2BSkill()\n"
            "    ' 네이티브 매크로 레코더 녹화에서 자동 변환됨\n"
            f"{indented}\n"
            "End Sub\n")


def summarize_vba_actions(body: str, limit: int = 3) -> str:
    """카드 설명용 한 줄 요약 — 주요 동사(값입력/서식/정렬/병합 등) 등장 횟수."""
    kinds = [
        ("값 입력", r"\.(?:FormulaR1C1|Formula|Value)\s*="),
        ("복사/붙여넣기", r"\.(?:Copy|Paste|PasteSpecial)\b"),
        ("서식", r"\.(?:Interior|Font|Borders|NumberFormat|HorizontalAlignment)\b"),
        ("병합", r"\.(?:Merge|MergeCells)\b"),
        ("정렬", r"\.Sort\b|SortFields"),
        ("필터", r"\.AutoFilter\b"),
        ("행/열", r"(?:Rows|Columns)\([^)]*\)\.(?:Insert|Delete)"),
        ("시트", r"Sheets\.(?:Add|Delete)|\.Name\s*="),
    ]
    found = []
    for label, pat in kinds:
        n = len(re.findall(pat, str(body or ""), re.I))
        if n:
            found.append(f"{label} {n}")
    head = " · ".join(found[:limit + 3])
    return head or "기록된 동작"


# ── COM 구현 (Excel 워커 스레드에서 excel_call 로 실행) ─────────────

def _existing_macro_modules(app):
    """모든 열린 워크북의 (wb, component_name) 표준 모듈 스냅샷(시작 전 기준선)."""
    seen = set()
    for wb in app.Workbooks:
        try:
            for comp in wb.VBProject.VBComponents:
                if int(comp.Type) == VBEXT_CT_STDMODULE:
                    seen.add((str(wb.Name), str(comp.Name)))
        except Exception:
            continue  # VBProject 접근 불가 워크북은 건너뜀(추출 시 다시 시도)
    return seen


def _record_button_label(app):
    """'매크로 기록' 리본 버튼의 현재 라벨. 못 읽으면 None."""
    try:
        return str(app.CommandBars.GetLabelMso(_MACRO_RECORD_IDMSO))
    except Exception:
        return None


def _macro_recording_active(app):
    """매크로 기록 중인지 — 'MacroRecord' 버튼 라벨이 '기록 중지'로 바뀌었는지로 판정.
    ('MacroRecord' 는 토글 버튼이 아니라 GetPressedMso 가 안 됨 → 라벨로 감지.)
    라벨을 못 읽으면 알 수 없음(None)."""
    lbl = _record_button_label(app)
    if lbl is None:
        return None
    low = lbl.lower()
    return any(h in low for h in _RECORDING_LABEL_HINTS)


def _spawn_dialog_confirmer(app, timeout=8.0):
    """ExecuteMso('MacroRecord') 가 띄우는 모달 '매크로 기록' 다이얼로그를
    포그라운드 포커스 없이 [확인]하는 Win32 워커(데몬 스레드).

    ExecuteMso 는 다이얼로그가 닫힐 때까지 블록하므로, 확인 입력은 (a)호출 전
    큐잉한 SendKeys 나 (b)이 스레드에서 와야 한다. SendKeys 는 Excel 이 활성창일
    때만 동작해 호스트(WebView 가 포그라운드)에서 불안정 → PostMessage 로 Enter 를
    다이얼로그 창에 직접 보내 포커스와 무관하게 기본 버튼(확인)을 누른다.

    COM 은 만지지 않고 Win32 만 사용 → 아파트먼트 이슈 없음. 실패해도 무해(무동작)."""
    try:
        import threading
        import time as _t
        import win32gui
        import win32con
        import win32process
    except Exception:
        return None
    try:
        main_hwnd = int(app.Hwnd)
        main_cls = win32gui.GetClassName(main_hwnd)  # 'XLMAIN'
        _, pid = win32process.GetWindowThreadProcessId(main_hwnd)
    except Exception:
        return None

    def _find_dialog():
        # '매크로 기록' 모달은 표준 '#32770' 이 아니라 Excel 전용 클래스
        # 'bosa_sdm_XL9' 다(실측). 이름/버전 변동에 견고하도록 같은 프로세스의
        # 보이는 최상위 팝업 중 메인 창(XLMAIN)이 아닌 것을 다이얼로그로 본다.
        found = []

        def _cb(h, _):
            try:
                if h == main_hwnd or not win32gui.IsWindowVisible(h):
                    return
                _, wpid = win32process.GetWindowThreadProcessId(h)
                if wpid != pid:
                    return
                cls = win32gui.GetClassName(h)
                if cls == main_cls:
                    return
                # bosa_sdm_XL9(Excel 다이얼로그) 우선, 그 외 팝업도 후보
                found.append((0 if cls.startswith("bosa_sdm") else 1, h))
            except Exception:
                pass
        try:
            win32gui.EnumWindows(_cb, None)
        except Exception:
            pass
        found.sort()
        return found[0][1] if found else None

    def _worker():
        deadline = _t.time() + timeout
        while _t.time() < deadline:
            h = _find_dialog()
            if h:
                # Enter → 다이얼로그 기본 버튼(확인). 한 번 더 여유있게 재전송.
                # (포그라운드 강탈은 회색 프레임/포커스 흔들림을 유발할 수 있어 쓰지 않는다 —
                #  자동 확인이 씹히면 클라 토스트가 '우측 엑셀 클릭'을 안내한다.)
                for _ in range(2):
                    try:
                        win32gui.PostMessage(h, win32con.WM_KEYDOWN, win32con.VK_RETURN, 0)
                        win32gui.PostMessage(h, win32con.WM_KEYUP, win32con.VK_RETURN, 0)
                    except Exception:
                        pass
                    _t.sleep(0.1)
                return
            _t.sleep(0.12)

    th = threading.Thread(target=_worker, name="rec-dialog-confirm", daemon=True)
    th.start()
    return th


# [NumLock 보존] Application.SendKeys 는 호출 자체가 NumLock 을 꺼버리는 고질 버그가 있다
# (보내는 키와 무관 — 실사용 보고: 녹화 버튼 누를 때마다 NumLock 꺼짐). 호출 전 상태를 읽고
# ExecuteMso(모달 닫힘까지 블록) 반환 후 달라졌으면 키 이벤트로 복원한다.
def _read_numlock_state():
    try:
        import ctypes
        return bool(ctypes.windll.user32.GetKeyState(0x90) & 1)  # VK_NUMLOCK
    except Exception:
        return None


def _restore_numlock_state(prev):
    if prev is None:
        return
    try:
        import ctypes
        cur = bool(ctypes.windll.user32.GetKeyState(0x90) & 1)
        if cur != prev:
            KEYEVENTF_EXTENDEDKEY = 0x1
            KEYEVENTF_KEYUP = 0x2
            ctypes.windll.user32.keybd_event(0x90, 0x45, KEYEVENTF_EXTENDEDKEY, 0)
            ctypes.windll.user32.keybd_event(0x90, 0x45, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)
    except Exception:
        pass


# [진단] 마지막 start/stop 의 레코더 상태 스냅샷 — serve_b2b 가 _vba_trace 로 남긴다.
# '두 번째 녹화 empty' 등 레코더 라이프사이클 desync 를 실측으로 잡기 위한 계측(동작 불변).
RECORD_DIAG = {}


def start_native_recording_impl(app):
    """레코더 토글 ON. 반환: 시작 전 모듈 기준선(정지 시 새 모듈 식별용).

    폴백이 없으므로(무조건 VBA) 시작을 확실히 한다:
    이미 기록 중이면 그대로 두고, 아니면 '매크로 기록' 모달을 Win32 로 자동 확인
    (+SendKeys 병행)한 뒤 토글. 상태 판정이 가능한데도 안 켜졌으면 명확한 에러."""
    baseline = _existing_macro_modules(app)
    RECORD_DIAG.clear()
    RECORD_DIAG["baseModules"] = len(baseline)
    # [절대참조 강제] '상대 참조로 기록'이 켜져 있으면(사용자/이전 세션 잔재 — 앱 전역
    # sticky) 기록이 ActiveCell.Offset 기반이 돼 재현 위치가 실행 시점 커서에 좌우된다.
    # 항상 끄고 시작한다(RecordRelative 는 읽기전용 → 리본 토글로 전환, 실측 검증).
    try:
        if bool(app.RecordRelative):
            app.CommandBars.ExecuteMso(_MACRO_RELATIVE_IDMSO)
    except Exception:
        pass
    state = _macro_recording_active(app)
    RECORD_DIAG["labelStateBefore"] = "recording" if state is True else ("idle" if state is False else "unknown")
    if state is True:
        # [진단] 여기로 오면 '이미 기록 중'으로 보고 조기 반환한다. 직전 정지가 라벨상 완전히
        # 안 꺼졌으면(stale True) 새 세션을 실제로 시작 안 해 두 번째 녹화가 비게 된다 — 이 경로가
        # 실측에서 잡히는지 확인하기 위해 표시(reused). 확정되면 여기서 재토글로 강제 클린스타트한다.
        RECORD_DIAG["path"] = "reused_already_on"
        return sorted(baseline)  # 이미 기록 중(사용자가 리본에서 켰음) — 재사용
    # ExecuteMso 는 '매크로 기록' 다이얼로그(모달)를 띄운다. 확인은 포커스 무관 Win32
    # 워커(PostMessage Enter)가 전담한다. 예전의 보조 SendKeys("~") 큐잉은 제거 —
    # ① Application.SendKeys 는 호출만으로 NumLock 을 뒤집는 고질 버그가 있고(저장→복원으로도
    #    못 막음: 워커가 다이얼로그를 먼저 닫으면 '~' 가 큐에 남았다가 나중에 재생되며 그때 뒤집힘),
    # ② 잔류 '~' 가 이후 사용자 라이브 Excel 입력에 끼어들 위험도 있다.
    # 워커 실패 시엔 아래 상태 확인이 명확한 안내 에러를 낸다(확인 버튼 수동 클릭 안내).
    _numlock_before = _read_numlock_state()
    _spawn_dialog_confirmer(app)
    app.CommandBars.ExecuteMso(_MACRO_RECORD_IDMSO)
    _restore_numlock_state(_numlock_before)  # 벨트+서스펜더(SendKeys 제거로 사실상 무동작)
    RECORD_DIAG["path"] = "toggled_fresh"
    _after = _macro_recording_active(app)
    RECORD_DIAG["labelStateAfter"] = "recording" if _after is True else ("idle" if _after is False else "unknown")
    # 상태를 읽을 수 있으면(True/False) 확실히 켜졌는지 확인. 못 읽으면(None) 통과.
    if _macro_recording_active(app) is False:
        raise RuntimeError(
            "매크로 기록을 시작하지 못했습니다. '매크로 기록' 창이 떠 있으면 [확인]을 눌러 주세요. "
            "반복되면 리본 [개발 도구] 탭에서 직접 '매크로 기록'을 켠 뒤 녹화를 다시 시작하세요.")
    return sorted(baseline)


def _touched_sheet_pairs(harvested, harvested_sheets):
    """녹화 청크에서 (워크북명, 시트명) 터치 집합 도출 — 재현 검증(expected) 수확용.

    각 청크의 Sheets("X")/Worksheets("X") 리터럴 + 정지 시점 활성 시트를 합친다.
    워크북당 상한(활성 시트 우선)으로 다이제스트 비용을 묶고, 존재하지 않는
    시트명(오탐 리터럴)은 capture_expected_states 가 걸러낸다(best-effort)."""
    import re
    pairs = []
    seen = set()
    per_book = {}
    PER_BOOK_CAP = 6

    def _add(book, sheet):
        if not book or not sheet:
            return
        key = (book, sheet)
        if key in seen or per_book.get(book, 0) >= PER_BOOK_CAP:
            return
        seen.add(key)
        per_book[book] = per_book.get(book, 0) + 1
        pairs.append(key)

    for i, item in enumerate(harvested):
        wb_name = item[0]
        raw = item[2] if len(item) > 2 else ""
        _add(wb_name, harvested_sheets[i] if i < len(harvested_sheets) else "")
        for m in re.finditer(r'(?:Worksheets|Sheets)\(\s*"([^"\r\n]+)"\s*\)', raw or ""):
            _add(wb_name, m.group(1))
    return pairs


def stop_native_recording_impl(app, baseline):
    """레코더 토글 OFF → 새로 생긴 매크로 모듈 추출·삭제 → 정제된 VBA 반환.

    반환: {"code": Sub B2BSkill 전체, "rawLines": 원본 줄수, "summary": 요약}
    기록이 없으면 code 가 빈 문자열.
    """
    RECORD_DIAG.clear()
    try:
        _lbl = _macro_recording_active(app)
        RECORD_DIAG["stopLabelBefore"] = "recording" if _lbl is True else ("idle" if _lbl is False else "unknown")
        if _lbl is not False:
            app.CommandBars.ExecuteMso(_MACRO_RECORD_IDMSO)  # 토글 OFF(기록 중지)
    except Exception:
        pass  # 이미 꺼져 있으면(사용자가 리본에서 껐으면) 추출만 진행
    base = {tuple(b) for b in (baseline or [])}
    RECORD_DIAG["baselineModules"] = len(base)
    _mod_errors = []          # 모듈 순회 중 삼킨 예외(아래에서 개수·첫 사유를 진단에 싣는다)
    # [교차 워크북] 회전(탭 전환 시 stop/start — 모달 때문에 느림) 대신, 정지 시 '모든
    # 워크북'의 새 매크로 모듈을 각각 수확한다. MS 레코더가 워크북별로 모듈을 만들면
    # 워크북 경계가 그대로 잡힌다(안 만들면 한 청크 = 종전과 동일, 탭 전환 부하 0).
    harvested = []  # [(wb_name, wb_fullname, raw_code)] — 발견 순서
    harvested_sheets = []  # harvested 와 인덱스 정렬 — 각 청크 워크북의 ActiveSheet.Name
    raw_total = 0
    for wb in app.Workbooks:
        try:
            comps = list(wb.VBProject.VBComponents)
        except Exception as e:
            raise RuntimeError(
                "기록된 매크로를 읽지 못했습니다 — Excel 옵션 > 보안 센터 > 매크로 설정에서 "
                "'VBA 프로젝트 개체 모델에 안전하게 액세스' 를 켜 주세요. "
                f"(원인: {e})")
        try:
            wb_name = str(wb.Name)
        except Exception:
            wb_name = ""
        try:
            wb_full = str(wb.FullName)
        except Exception:
            wb_full = ""
        for comp in comps:
            try:
                if int(comp.Type) != VBEXT_CT_STDMODULE:
                    continue
                if (wb_name, str(comp.Name)) in base:
                    continue
                cm = comp.CodeModule
                n = int(cm.CountOfLines)
                code = cm.Lines(1, n) if n else ""
                if "Sub " not in code:
                    continue
                body = sanitize_recorded_vba(extract_macro_body(code))
                wb.VBProject.VBComponents.Remove(comp)  # 워크북 오염 방지(발견 즉시 제거)
                if body.strip():
                    # [3A] 실행기 '파일확인'이 필요 시트를 잡도록 워크북의 활성 시트명 수확.
                    # (이미 excel_call 워커 안이라 COM 접근 안전. 실패 시 빈 문자열.)
                    try:
                        wb_sheet = str(wb.ActiveSheet.Name)
                    except Exception:
                        wb_sheet = ""
                    harvested.append((wb_name, wb_full, code))
                    harvested_sheets.append(wb_sheet)
                    raw_total += code.count("\n") + 1
            except Exception as _me:
                # [계측 2026-08-31] 여기서 조용히 건너뛰면 harvested=0 인데 이유가 안 남는다.
                # 대표 원인은 VBProject 접근 거부(매크로 보안 설정) — 사용자 PC 마다 다르다.
                _mod_errors.append(str(_me)[:120])
                continue
    RECORD_DIAG["harvested"] = len(harvested)
    RECORD_DIAG["rawLines"] = raw_total
    RECORD_DIAG["moduleErrors"] = len(_mod_errors)
    RECORD_DIAG["moduleError1"] = _mod_errors[0] if _mod_errors else ""
    if not harvested:
        return {"code": "", "rawLines": 0, "summary": "",
                "recordedWorkbook": "", "recordedWorkbookFullName": "",
                "recordedSheet": ""}

    def _q(name):
        return str(name).replace('"', '""')

    if len(harvested) == 1:
        wb_name, wb_full, raw = harvested[0]
        combined = sanitize_recorded_vba(extract_macro_body(raw))
        # [초기 컨텍스트 명시] 레코더는 '녹화 시작 시 활성 워크북'을 코드에 안 남긴다 — 원본은
        # 그 워크북에서 암묵적으로 시작한다. 격리 재현 인스턴스는 마지막에 연 동반본이 활성이라,
        # 선행 Activate 없는 첫 동작들이 엉뚱한 워크북에서 실행됐다(실측 15:30: 1조각 복붙이
        # 정산서에서 돌아 청구내역 I1 유실). 시작 워크북 Activate 를 맨 앞에 명시한다.
        if combined.strip() and not re.match(
                r'^\s*(?:Windows|Workbooks)\(\s*"', combined.lstrip()):
            combined = 'Workbooks("%s").Activate\n%s' % (_q(wb_name), combined)
    else:
        # 다중 워크북 — 각 청크 앞에 Workbooks("...").Activate 를 끼워 조립한다.
        # 재현이 녹화와 같은 워크북에서 실행되도록(교차 복붙 꼬임 수정).
        parts = []
        for wb_name, _wb_full, raw in harvested:
            parts.append('Workbooks("%s").Activate' % _q(wb_name))
            parts.append(sanitize_recorded_vba(extract_macro_body(raw)))
        combined = "\n".join(p for p in parts if p.strip())

    # [동적 시트 참조] Sheets.Add 로 만든 새 시트의 고정 이름 참조를 런타임 캡처
    # 변수로 — 절대참조가 약한 동적 시트명에 한해 동적 참조 허용(피벗 재현 안정화).
    combined = rewrite_new_sheet_refs(combined)

    RECORD_DIAG["combinedLines"] = (len(combined.splitlines()) if combined.strip() else 0)
    if not combined.strip():
        # 수확은 됐는데(rawLines>0) 정제 후 빈손이면 sanitize/rewrite 단계에서 다 깎인 것이다.
        # 이 두 숫자를 나란히 봐야 '수집 실패'와 '정제 과다'를 가를 수 있다.
        RECORD_DIAG["emptyAfterSanitize"] = True
        return {"code": "", "rawLines": raw_total, "summary": "",
                "recordedWorkbook": harvested[0][0], "recordedWorkbookFullName": harvested[0][1],
                "recordedSheet": harvested_sheets[0] if harvested_sheets else ""}
    # [재현 검증 수확] 정지 시점 touched 시트들의 다이제스트(expected) — 프론트가 재현 후
    # /api/excel/record/verify 로 대조한다. python 엔진 stop(record_service)과 같은 함수
    # (sheet_expected_state)로 계산해 기존 검증 인프라가 그대로 소비한다. 예전엔 네이티브
    # (VBA=기본) 경로가 expected 를 안 실어 검증 블록이 死코드였다 — 이중 반영/시트 어긋남을
    # 잡을 유일한 그물이 꺼져 있었다. best-effort: 실패해도 녹화 결과를 막지 않는다.
    expected = []
    try:
        from record_service import capture_expected_states
        expected = capture_expected_states(
            app, set(_touched_sheet_pairs(harvested, harvested_sheets)))
    except Exception:
        expected = []
    return {
        "code": wrap_as_b2b_skill(combined),
        "rawLines": raw_total,
        "summary": summarize_vba_actions(combined),
        # 대상 바인딩은 '녹화가 시작된 워크북'(첫 청크). 이후 워크북들은 코드의
        # Workbooks() 참조로 재현 인프라가 동반 오픈/동기화한다.
        "recordedWorkbook": harvested[0][0],
        "recordedWorkbookFullName": harvested[0][1],
        # [3A] 첫 청크 워크북의 활성 시트명(실행기 '파일확인'이 필요 시트 매칭용).
        "recordedSheet": harvested_sheets[0] if harvested_sheets else "",
        "expected": expected,
    }

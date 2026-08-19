# -*- coding: utf-8 -*-
"""[비용] 격리 실행이 '읽기만 한 동반 파일'까지 라이브로 되돌려쓰던 낭비를 막는다.

VM 실측 (2026-08-12)
  output 한 개만 건드리는 스텝인데도 격리 인스턴스가 라이브 세션 4개를 전부 열고(25.5초),
  끝나고 그 4개를 전부 라이브로 되돌려썼다(34.4초). 덤으로 각 세션의 appliedStepSigs 를
  지워 그 파일들의 '다음 적용'까지 전체 재적용으로 만들었다.

  Saved == False 하나로 판정한 게 원인이다 — 엑셀은 읽기만 해도 재계산·링크 때문에 dirty 가
  된다. 이제 '이번 실행에서 실제로 바뀐 워크북'을 저널 시점에 기록해서 그것만 되돌려쓴다.

  '여는 쪽'도 같이 게이트했다가 되돌렸다(적대 검증에서 조용한 오염 경로 확인) —
  serve_b2b.py 의 _setup_isolated_pipeline_instance 도크스트링에 사유를 남겼다.
  이 테스트는 그 철회가 유지되는지도 함께 잠근다.

이 테스트가 잠그는 것
  1. 추적이 불완전하면(VBA 스텝·구조변경) 예전처럼 변경된 것을 전부 되돌려쓴다
  2. 위장 포맷(excel_open_<uuid> 로 리네임돼 열린 파일)도 되돌려쓰기를 놓치지 않는다  ← 유실 방지 핵심
  3. 이름을 못 읽은 동반본은 판정에서 빼고 늘 되돌려쓴다
  4. 여는 쪽은 게이트하지 않는다(철회 유지)
  5. 덤 — 교차파일 쓰기의 실패 롤백이 엉뚱한 워크북에 복원되지 않는다
"""
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT / "serve_b2b.py").read_text(encoding="utf-8-sig")


def _slice(start_marker, end_marker):
    i = SRC.index(start_marker)
    j = SRC.index(end_marker, i)
    return SRC[i:j]


fails = 0


def check(name, cond, detail=None):
    global fails
    if cond:
        print("  PASS  " + name)
    else:
        fails += 1
        print("  FAIL  " + name + ("  → " + str(detail)[:200] if detail is not None else ""))


def step(code, language="python"):
    return {"code": code, "language": language}


# ---- 게이트 B: 되돌려쓰기 ----
print("[1] 되돌려쓰기 게이트 — 실제로 바뀐 것만")

synced = []


class _CWb:
    def __init__(self, name, saved):
        self.Name = name
        self.Saved = saved

    def SaveCopyAs(self, p):
        Path(p).write_text("x", encoding="utf-8")


class _OWb:
    Name = "live"


class _OApp:
    ScreenUpdating = True


_ns2 = {
    "Path": Path,
    "unicodedata": unicodedata,
    "uuid": __import__("uuid"),
    # 실제 코드가 `if not other: continue` 로 거르므로 빈 dict 를 쓰면 안 된다(세션은 항상 내용이 있다)
    "EXCEL_SESSIONS": {"o1": {"rev": 0}, "o2": {"rev": 0}, "o3": {"rev": 0}},
    "session_workbook": lambda other: (_OApp(), _OWb()),
    "_copy_source_workbook_into_target": lambda a, w, p: synced.append(Path(p).name),
    "_protect_workbook_for_read_only_mirror": lambda w, on: None,
    "_restore_live_window": lambda o, a, w: None,
    "_vba_trace": lambda *a, **k: None,
}
exec(_slice("def _sync_modified_companions_into_live(", "\ndef _run_vba_pipeline_on_session_impl("), _ns2)
sync = _ns2["_sync_modified_companions_into_live"]

import tempfile

WORK = Path(tempfile.mkdtemp(prefix="b2b_gate_test_"))


def run_sync(comps, mutated, tracked):
    synced.clear()
    sync(comps, "e1", 1234, WORK, mutated_books=mutated, mutation_tracked=tracked)
    return sorted(synced)


COMPS = [
    {"excelId": "o1", "name": "입력.xlsx", "openedName": "입력.xlsx", "wb": _CWb("입력.xlsx", False)},
    {"excelId": "o2", "name": "출력.xlsx", "openedName": "출력.xlsx", "wb": _CWb("출력.xlsx", False)},
    {"excelId": "o3", "name": "안건드림.xlsx", "openedName": "안건드림.xlsx", "wb": _CWb("안건드림.xlsx", True)},
]

check("추적 가능 + 실제로 쓴 것만 되돌려쓴다",
      run_sync(COMPS, {"출력.xlsx"}, True) == ["출력.xlsx"], run_sync(COMPS, {"출력.xlsx"}, True))
check("읽기만 한 파일(Saved=False 여도)은 건너뛴다  ← 34초 절약 지점",
      "입력.xlsx" not in run_sync(COMPS, {"출력.xlsx"}, True))
check("추적 불가(VBA/구조변경)면 예전처럼 변경된 것 전부 되돌려쓴다",
      run_sync(COMPS, set(), False) == ["입력.xlsx", "출력.xlsx"], run_sync(COMPS, set(), False))
check("Saved=True 는 어느 경우에도 안 쓴다",
      "안건드림.xlsx" not in run_sync(COMPS, {"안건드림.xlsx"}, True))
check("아무것도 안 썼으면 아무것도 안 한다", run_sync(COMPS, set(), True) == [])

print("[2] 위장 포맷 — 열린 이름이 등록명과 다를 때도 놓치지 않는다  ← 유실 방지")
DISGUISED = [{"excelId": "o1", "name": "정산.xls", "openedName": "excel_open_9f2a.xlsx",
              "wb": _CWb("excel_open_9f2a.xlsx", False)}]
check("실제 열린 이름으로 기록돼도 되돌려쓴다",
      run_sync(DISGUISED, {"excel_open_9f2a.xlsx"}, True) == ["정산.xls"],
      run_sync(DISGUISED, {"excel_open_9f2a.xlsx"}, True))
check("등록명으로 기록돼도 되돌려쓴다",
      run_sync(DISGUISED, {"정산.xls"}, True) == ["정산.xls"])

print("[3] 이름을 못 읽은 동반본은 판정에서 뺀다(대조 불가 → 늘 되돌려쓴다)")
UNKNOWN = [{"excelId": "o1", "name": "정산.xlsx", "openedName": "", "nameUnknown": True,
            "wb": _CWb("정산.xlsx", False)}]
check("nameUnknown 이면 mutated 에 없어도 되돌려쓴다",
      run_sync(UNKNOWN, {"딴것.xlsx"}, True) == ["정산.xlsx"], run_sync(UNKNOWN, {"딴것.xlsx"}, True))

print("[4] 여는 쪽은 게이트하지 않는다 — 적대 검증으로 철회한 결정 유지")
check("setup 시그니처에 steps 게이트가 없다",
      "def _setup_isolated_pipeline_instance(session, excel_id, reset, work):" in SRC)
check("코드 문자열로 동반본을 거르는 헬퍼가 없다",
      "_isolated_companion_reference_blob" not in SRC and "_companion_referenced" not in SRC)
check("철회 사유가 코드에 남아 있다(다음 사람이 같은 함정에 안 빠지게)",
      "[열기 게이트 시도와 철회 2026-08-12]" in SRC)

print("[5] 배선 — 실제 실행 경로에 붙어 있는가")
check("Python 스텝 요약에서 바뀐 워크북을 모은다",
      re.search(r'_psum\.get\("mutationTracked"\)[\s\S]{0,240}_mutated_books\.update', SRC) is not None)
check("VBA 스텝이 하나라도 있으면 추적을 포기한다",
      re.search(r'_inject_and_run_vba\(fapp, ftarget, code, entry\)\s*\n\s*_mutation_tracked = False', SRC) is not None)
check("동기화 호출이 증거를 넘긴다",
      "mutated_books=_mutated_books" in SRC and "mutation_tracked=_mutation_tracked" in SRC)
check("쓰기 기록은 시트의 부모 워크북으로 한다(고정 워크북 아님)",
      "ws.Parent.Name" in SRC and "def _mark_mutated(self, ws):" in SRC)
check("저널 저장 '첫 줄'에 표시한다(저널 append 가 실패해도 변경 사실은 남게)",
      # 시그니처에 new_data 가 붙었다(지움 감지용, SBAGENT-271) — '첫 줄이 _mark_mutated' 계약은 그대로.
      re.search(r"def _journal_save\(self, ws, rng[^)]*\):\s*\n\s*book = self\._mark_mutated\(ws\)", SRC) is not None)

print("[6] 덤 — 교차파일 쓰기의 롤백이 엉뚱한 워크북에 복원되던 문제")
check("저널에 워크북 이름도 남긴다",
      'self._shared["journal"].append((str(ws.Name), address, formulas, book))' in SRC)
check("롤백이 저널의 워크북에서 시트를 찾는다(고정 워크북 아님)",
      "ws = self._rollback_book(book_name).Worksheets(ws_name)" in SRC)
check("이름을 못 찾으면 예전처럼 고정 워크북으로(동작 보존)",
      re.search(r"def _rollback_book\(self, book_name\):[\s\S]{0,700}return self\._wb\s*\n\s*\n", SRC) is not None)
check("옛 3-튜플 저널도 안 터진다",
      'book_name = entry[3] if len(entry) > 3 else ""' in SRC)
check("구조변경이 하나라도 있으면 mutationTracked=False",
      '"mutationTracked": not self._shared["structural"],' in SRC)

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)

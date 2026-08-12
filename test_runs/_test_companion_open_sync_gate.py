# -*- coding: utf-8 -*-
"""[비용] 격리 실행이 '안 쓰는 동반 파일'을 열고 되돌려쓰던 낭비를 막는다.

VM 실측 (2026-08-12)
  output 한 개만 건드리는 스텝인데도 격리 인스턴스가 라이브 세션 4개를 전부 열었다
  (31MB 짜리 포함, SaveCopyAs+오픈 25.5초). 실행이 끝나면 그 4개를 다시 라이브로
  되돌려쓰느라 34.4초를 더 썼고, 덤으로 각 세션의 appliedStepSigs 를 지워 그 파일들의
  '다음 적용'까지 전체 재적용으로 만들었다. 순수 낭비 60초.

두 개의 게이트
  (A) 여는 쪽   — 스텝 코드가 이름을 대고 부르는 파일 + 대상이 수식으로 링크한 파일만 연다
  (B) 쓰는 쪽   — 이번 실행에서 '실제로 바뀐' 워크북만 라이브로 되돌려쓴다

이 테스트가 잠그는 것 — 두 게이트 모두 '안전한 쪽으로 실패'하는가
  1. 코드에서 파일명을 확신할 수 없으면(변수/인덱스로 워크북을 잡으면) 게이트를 포기하고 전부 연다
  2. 수식 링크 대상은 코드에 안 나와도 연다
  3. 쓰기 추적이 불완전하면(VBA·구조변경) 예전처럼 변경된 것을 전부 되돌려쓴다
  4. 위장 포맷(excel_open_<uuid> 로 리네임돼 열린 파일)도 되돌려쓰기를 놓치지 않는다  ← 유실 방지 핵심
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


# ---- 순수 헬퍼(게이트 A) 를 그대로 떼어 실행 ----
_ns = {"re": re, "unicodedata": unicodedata, "Path": Path}
exec(_slice("_BOOK_CALL_RE = re.compile(", "\ndef _setup_isolated_pipeline_instance("), _ns)
blob_of = _ns["_isolated_companion_reference_blob"]
referenced = _ns["_companion_referenced"]
link_names_of = _ns["_workbook_link_source_names"]

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


print("[1] 코드에서 파일명을 확신할 수 있는가 — 없으면 게이트 포기(전부 열기)")
check("리터럴 ctx.book → 게이트 작동",
      blob_of([step('out = ctx.book("8월_정산서.xlsx")\nout.write("Sheet1", 1, 1, [[1]])')]) is not None)
check("변수로 워크북을 잡으면 포기",
      blob_of([step('name = pick()\nout = ctx.book(name)')]) is None)
check("f-string 도 포기",
      blob_of([step('out = ctx.book(f"{month}_정산서.xlsx")')]) is None)
check("VBA Workbooks(\"이름\") → 게이트 작동",
      blob_of([step('Workbooks("8월_정산서.xlsx").Sheets(1).Range("A1") = 1', "vba")]) is not None)
check("VBA Workbooks(1) 인덱스 참조는 포기",
      blob_of([step('Workbooks(1).Sheets(1).Range("A1") = 1', "vba")]) is None)
check("VBA Windows(변수) 도 포기",
      blob_of([step('Windows(nm).Activate', "vba")]) is None)
check("스텝 중 하나만 불확실해도 전부 포기(부분 게이트 금지)",
      blob_of([step('ctx.book("a.xlsx")'), step('ctx.book(v)')]) is None)
check("스텝 없음 → 포기", blob_of([]) is None and blob_of(None) is None)
check("코드 없는 스텝만 → 포기", blob_of([{"code": ""}]) is None)

print("[2] 이 동반 파일을 열어야 하는가")
b = blob_of([step('src = ctx.book("입력_기업DW.xlsx")\nctx.write("결과", 1, 1, src.read("Sheet1", 1, 1, 5, 5))')])
check("코드에 이름이 박힌 파일은 연다", referenced("입력_기업DW.xlsx", b, set()))
check("언급 없는 파일은 안 연다", referenced("8월_지사현황.xlsx", b, set()) is False)
check("확장자만 다르면(stem 일치) 연다 — 느슨한 쪽이 안전",
      referenced("입력_기업DW.xlsm", b, set()))
check("대소문자 무시", referenced("입력_기업DW.XLSX", b, set()))
check("게이트 포기(None)면 전부 연다", referenced("아무거나.xlsx", None, set()))
check("수식 링크 대상은 코드에 없어도 연다",
      referenced("8월_지사현황.xlsx", b, {"8월_지사현황.xlsx"}))
check("빈 이름은 안 연다", referenced("", b, set()) is False)
check("한 글자 stem 은 부분일치로 열지 않는다(오탐 방지)",
      referenced("a.xlsx", blob_of([step('ctx.write("Sheet1", 1, 1, [["a"]])')]), set()) is False)

print("[3] NFC/NFD 표기가 달라도 같은 파일로 본다(한글 파일명)")
nfc = unicodedata.normalize("NFC", "정산서.xlsx")
nfd = unicodedata.normalize("NFD", "정산서.xlsx")
check("코드가 NFD, 세션명이 NFC 여도 매칭",
      referenced(nfc, blob_of([step('ctx.book("%s")' % nfd)]), set()), (nfc == nfd))

print("[4] LinkSources 파싱")


class _WbLinks:
    def __init__(self, v):
        self._v = v

    def LinkSources(self, kind):
        return self._v


check("링크 없음 → 빈 집합", link_names_of(_WbLinks(None)) == set())
check("전체경로에서 파일명만", link_names_of(_WbLinks((r"C:\a\b\원본.xlsx",))) == {"원본.xlsx"})
check("단일 문자열도 처리", link_names_of(_WbLinks(r"C:\a\원본.xlsx")) == {"원본.xlsx"})


class _WbBoom:
    def LinkSources(self, kind):
        raise RuntimeError("COM 죽음")


check("COM 예외는 빈 집합(막지 않는다)", link_names_of(_WbBoom()) == set())

# ---- 게이트 B: 되돌려쓰기 ----
print("[5] 되돌려쓰기 게이트 — 실제로 바뀐 것만")

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

print("[6] 위장 포맷 — 열린 이름이 등록명과 다를 때도 놓치지 않는다  ← 유실 방지")
DISGUISED = [{"excelId": "o1", "name": "정산.xls", "openedName": "excel_open_9f2a.xlsx",
              "wb": _CWb("excel_open_9f2a.xlsx", False)}]
check("실제 열린 이름으로 기록돼도 되돌려쓴다",
      run_sync(DISGUISED, {"excel_open_9f2a.xlsx"}, True) == ["정산.xls"],
      run_sync(DISGUISED, {"excel_open_9f2a.xlsx"}, True))
check("등록명으로 기록돼도 되돌려쓴다",
      run_sync(DISGUISED, {"정산.xls"}, True) == ["정산.xls"])

print("[7] 배선 — 실제 실행 경로에 붙어 있는가")
check("격리 setup 이 steps 를 받는다",
      "def _setup_isolated_pipeline_instance(session, excel_id, reset, work, steps=None):" in SRC)
check("호출부가 steps 를 넘긴다",
      "_setup_isolated_pipeline_instance(session, excel_id, reset, work, steps)" in SRC)
check("Python 스텝 요약에서 바뀐 워크북을 모은다",
      re.search(r'_psum\.get\("mutationTracked"\)[\s\S]{0,120}_mutated_books\.update', SRC) is not None)
check("VBA 스텝이 하나라도 있으면 추적을 포기한다",
      re.search(r'_inject_and_run_vba\(fapp, ftarget, code, entry\)\s*\n\s*_mutation_tracked = False', SRC) is not None)
check("동기화 호출이 증거를 넘긴다",
      "mutated_books=_mutated_books" in SRC and "mutation_tracked=_mutation_tracked" in SRC)
check("쓰기 기록은 시트의 부모 워크북으로 한다(고정 워크북 아님)",
      "ws.Parent.Name" in SRC and "def _mark_mutated(self, ws):" in SRC)
check("저널 저장 '첫 줄'에 표시한다(저널 append 가 실패해도 변경 사실은 남게)",
      re.search(r"def _journal_save\(self, ws, rng\):\s*\n\s*book = self\._mark_mutated\(ws\)", SRC) is not None)

print("[8] 덤 — 교차파일 쓰기의 롤백이 엉뚱한 워크북에 복원되던 문제")
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

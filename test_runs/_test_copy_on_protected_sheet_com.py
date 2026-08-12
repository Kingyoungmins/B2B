# -*- coding: utf-8 -*-
"""[실측/COM] 잠긴 시트에 '네이티브 복사'가 되는가 — 사용자 제보 2026-08-12 재현.

제보한 상황
  "보호를 건 적이 없는데" ctx.copy 가 "'정산' 시트가 보호되어 있어" 로 실패했다.
  같은 일을 ctx.read → ctx.write 로 바꾸면 성공했다.

원인
  사용자 파일이 아니라 **앱이 라이브 미러에 거는 편집 잠금**이다.
    · 라이브 시트는 UserInterfaceOnly=True 로 보호한다 → 화면 편집만 막고 COM 쓰기는 허용.
    · 그래서 Range.Value 대입(ctx.write)은 통과한다.
    · 그런데 Range.Copy(Destination) 은 '붙여넣기'라 UI 동작으로 취급돼 보호에 막힌다.
  결과: 서식까지 보존하는 복사만 골라서 실패했고, 사용자에겐 '내가 안 건 보호'로 보였다.

이 테스트가 잠그는 것
  1. UserInterfaceOnly 보호 시트에 Range.Value 쓰기는 된다(전제 확인)
  2. 같은 시트에 Range.Copy(Destination) 은 원래 막힌다(전제 확인 — 이게 제보의 원인)
  3. ctx.copy 는 그 시트에도 성공하고 값·서식이 넘어간다   ← 이번 수정
  4. 복사 후 잠금이 원래대로 돌아온다(화면 편집이 다시 막힌다)
  5. 사용자가 '자기 암호'로 건 보호는 풀지 않는다(남의 보호를 몰래 열지 않는다)

실행: python test_runs/_test_copy_on_protected_sheet_com.py   (Excel 필요)
"""
import io
import sys
import tempfile
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pythoncom  # noqa: E402
pythoncom.CoInitialize()
import win32com.client as w  # noqa: E402
import serve_b2b as S  # noqa: E402

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:200]) if (not cond and detail) else ""))
    if not cond:
        fails += 1


class Ctx(S.PythonComSkillContext):
    def __init__(self, wb, app):
        self._wb = wb
        self._app = app
        self._session = None
        self._shared = {"structural": [], "deadline": float("inf"), "books": {}, "journal": []}

    def _tick(self, n=1):
        pass


app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
work = Path(tempfile.mkdtemp(prefix="b2b_protcopy_"))
wb = None
try:
    wb = app.Workbooks.Add()
    src = wb.Worksheets(1)
    src.Name = "피벗"
    dst = wb.Worksheets.Add()
    dst.Name = "정산"

    # 원본: 값 + 눈에 보이는 서식(굵게) — 서식까지 넘어가는지 보려고
    for i, (a, b) in enumerate([("가", 100), ("나", 200), ("다", 300)], start=1):
        src.Cells(i, 1).Value = a
        src.Cells(i, 2).Value = b
    src.Range("A1:B1").Font.Bold = True

    # 앱이 라이브에 거는 것과 똑같은 잠금을 건다
    S._protect_workbook_for_read_only_mirror(wb, True)
    check("[전제] 대상 시트가 잠겼다", bool(dst.ProtectContents))

    print("[1] 잠긴 시트에서 무엇이 되고 무엇이 안 되나")
    try:
        dst.Range("D1").Value = "직접쓰기"
        wrote = dst.Range("D1").Value == "직접쓰기"
    except Exception as err:
        wrote = False
        print("      (쓰기 예외: %s)" % str(err)[:120])
    check("값 쓰기는 된다(UserInterfaceOnly)", wrote)

    blocked = False
    try:
        src.Range("A1:B3").Copy(dst.Range("F1"))
    except Exception as err:
        blocked = True
        print("      (복사 차단 확인: %s)" % str(err)[:140])
    check("네이티브 복사는 막힌다 ← 제보의 원인", blocked)

    print("[2] ctx.copy 는 잠긴 시트에도 복사한다  ← 이번 수정")
    ctx = Ctx(wb, app)
    ok = False
    try:
        ok = ctx.copy("피벗", "A1:B3", "정산", "A1")
    except Exception as err:
        print("      (실패: %s)" % str(err)[:200])
    check("ctx.copy 성공", bool(ok))
    check("값이 넘어감", [dst.Cells(r, 1).Value for r in (1, 2, 3)] == ["가", "나", "다"],
          [dst.Cells(r, 1).Value for r in (1, 2, 3)])
    check("숫자도 넘어감", [dst.Cells(r, 2).Value for r in (1, 2, 3)] == [100, 200, 300],
          [dst.Cells(r, 2).Value for r in (1, 2, 3)])
    check("서식(굵게)까지 보존 — read/write 우회로는 못 하는 것", bool(dst.Range("A1").Font.Bold))

    print("[3] 복사 뒤 잠금이 원래대로 돌아왔나")
    check("대상 시트가 다시 잠김", bool(dst.ProtectContents))
    check("원본 시트 잠금도 그대로", bool(src.ProtectContents))
    # 다시 복사해도 되는지(잠금 원복이 다음 복사를 막지 않는지)
    ok2 = False
    try:
        ok2 = ctx.copy("피벗", "A1:B3", "정산", "H1")
    except Exception as err:
        print("      (2회차 실패: %s)" % str(err)[:200])
    check("연속 복사도 된다", bool(ok2) and dst.Range("H1").Value == "가")

    print("[4] 사용자가 자기 암호로 건 보호는 건드리지 않는다")
    other = wb.Worksheets.Add()
    other.Name = "사용자보호"
    other.Protect("사용자암호1234")
    denied = False
    try:
        ctx.copy("피벗", "A1:B3", "사용자보호", "A1")
    except Exception:
        denied = True
    check("남의 보호는 못 뚫는다(원래 오류 유지)", denied)
    check("남의 보호가 풀리지 않았다", bool(other.ProtectContents))
    try:
        other.Unprotect("사용자암호1234")
    except Exception:
        pass
finally:
    try:
        if wb is not None:
            wb.Close(SaveChanges=False)
    except Exception:
        pass
    try:
        app.Quit()
    except Exception:
        pass
    pythoncom.CoUninitialize()

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)

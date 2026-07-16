# [포맷별 오픈/저장] .xlsx/.xlsm/.xls/.xlsb/.csv/.tsv 경로 회귀 검증 (Excel COM 불필요).
# python test_runs/_test_format_paths.py
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
import serve_b2b as s

fails = 0


def ck(name, cond, got=None):
    global fails
    print(("  OK  " if cond else "FAIL ") + name + ("" if cond else f"  got={got!r}"))
    if not cond:
        fails += 1


def _wb(sheet_count):
    class W:
        class _W:
            Count = sheet_count
        Worksheets = _W()
    return W()


# ── CSV 멀티시트 승격 ────────────────────────────────────────────────────────
# CSV 는 시트를 1장만 담는다. 스킬이 시트를 추가한 결과를 CSV 로 저장하면 SaveCopyAs 가
# ActiveSheet 1장만 기록하고, 그 1장짜리 스냅샷이 라이브의 모든 시트를 Delete 하고 되돌아온다
# (_copy_source_workbook_into_target) → 무성 데이터 손실. 승격이 그 방어막이다.
ck("csv 멀티시트 → xlsx 승격", s._promote_csv_multisheet_name("data.csv", _wb(3)) == "data.xlsx",
   s._promote_csv_multisheet_name("data.csv", _wb(3)))
ck("csv 단일시트는 그대로", s._promote_csv_multisheet_name("data.csv", _wb(1)) == "data.csv")
ck("tsv 멀티시트 → xlsx 승격", s._promote_csv_multisheet_name("t.tsv", _wb(2)) == "t.xlsx")
ck("xlsx 는 불변", s._promote_csv_multisheet_name("book.xlsx", _wb(3)) == "book.xlsx")
ck("xlsb 는 불변(51 로 강등 금지)", s._promote_csv_multisheet_name("data.xlsb", _wb(3)) == "data.xlsb")
ck("xls 는 불변(56 유지)", s._promote_csv_multisheet_name("old.xls", _wb(3)) == "old.xls")
ck("xlsm 은 불변(매크로 보존)", s._promote_csv_multisheet_name("m.xlsm", _wb(3)) == "m.xlsm")
# [회귀] 이중 확장자: stem 이 "a.xlsx" 라 그대로 붙이면 "a.xlsx.xlsx" 가 됐다.
ck("이중 확장자 a.xlsx.csv → a.xlsx", s._promote_csv_multisheet_name("a.xlsx.csv", _wb(3)) == "a.xlsx",
   s._promote_csv_multisheet_name("a.xlsx.csv", _wb(3)))

# ── 승격이 '적용' 경로에도 걸려 있는가(반쪽 수정 방지) ──────────────────────────
# 예전엔 다운로드 경로에만 있어서, 단일 '적용' 버튼이 CSV 시트를 조용히 날렸다.
src = open("serve_b2b.py", encoding="utf-8").read()
ck("단일 적용 경로에 승격 적용됨",
   "_promoted_name = _promote_csv_multisheet_name(result_name, ftarget)" in src)
ck("승격 시 SaveAs(FileFormat=51) 사용(SaveCopyAs 는 CSV 포맷 유지)",
   "ftarget.SaveAs(str(rpath), FileFormat=51)" in src)

# ── VBA 워크북 리터럴 별칭이 전 포맷을 커버하는가 ─────────────────────────────
# 별칭 인프라는 전 포맷을 커버하는데 VBA 치환만 '.xls' 게이트에 묶여 있어, 같은 파일이
# Python(ctx.book)에선 되고 VBA 에선 '첨자가 범위를 벗어났습니다'로 죽는 엔진별 갈림이었다.
s._excel_process_id = lambda app: 4242   # Hwnd→pid 조회만 스텁(COM 불필요)


class _WB:
    def __init__(self, name):
        self.Name = name


class _App:
    def __init__(self, names):
        self.Workbooks = [_WB(n) for n in names]


for registered, actual in [("정산_2026_05.csv", "excel_open_ab12cd34ef56.tsv"),
                           ("표.tsv", "excel_open_bb22cd34ef56.xlsx"),
                           ("보고서.html", "excel_open_cc33cd34ef56.xlsx"),
                           ("일반.xlsx", "excel_open_dd44cd34ef56.xlsb")]:
    app = _App([actual])
    s._stash_workbook_name_alias(app, registered, actual)
    code = f'Set wb = Workbooks("{registered}")'
    out = s._normalize_vba_workbook_literals(app, code)
    ck(f"VBA 별칭 치환: {registered}", actual in out, out)

# 대조군: 별칭이 없으면 원문 그대로(과도한 치환 금지)
app = _App(["excel_open_ab12cd34ef56.tsv"])
ctl = 'Set wb = Workbooks("없는파일.csv")'
ck("별칭 없으면 원문 유지", s._normalize_vba_workbook_literals(app, ctl) == ctl)
# 대조군: 워크북 리터럴이 아닌 코드는 건드리지 않음
plain = 'Range("A1").Value = 1'
ck("워크북 리터럴 아니면 무변경", s._normalize_vba_workbook_literals(app, plain) == plain)

# ── UI 업로드 허용 확장자 ────────────────────────────────────────────────────
# 백엔드는 .xlsb 를 1급 지원하는데 picker 에서 빠져 '드롭하면 되고 찾아보기로는 안 되는' 상태였다.
html = open("index.html", encoding="utf-8").read()
ck("파일 picker 에 .xlsb 포함", html.count('accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.tsv"') == 2)

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else f"{fails} FAIL") + " ===")
sys.exit(1 if fails else 0)

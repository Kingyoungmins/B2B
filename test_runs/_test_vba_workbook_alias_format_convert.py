#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SBAGENT-138: .xls 로 위장한 HTML/CSV 가 excel_open_<uuid>.html 로 변환·리네임돼 열려,
VBA Workbooks("등록명.xls") 가 subscript out of range 로 실패하던 버그 수정 검증.
열 때 등록명→실제명 별칭 저장 → _normalize_vba_workbook_literals 가 그 별칭으로 실제명 치환.
(시트명은 이미 실제명이라 안 건드림.) mock app 으로 순수 단위검증(COM 불필요)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import serve_b2b as s


class _Collection(list):
    @property
    def Count(self):
        return len(self)
    def Item(self, idx):
        return self[int(idx) - 1]


class _Sheet:
    def __init__(self, name): self.Name = name


class _W:
    def __init__(self, name, sheets=None):
        self.Name = name
        self.Worksheets = _Collection([_Sheet(s) for s in (sheets or [])])


class _App:
    def __init__(self, names):
        self._items = []
        for item in names:
            if isinstance(item, tuple):
                self._items.append(_W(item[0], item[1]))
            else:
                self._items.append(_W(item))
    @property
    def Workbooks(self): return _Collection(self._items)


s._excel_process_id = lambda app: 0xB2B  # mock 안정 pid

pass_ = 0; fail = 0
def ck(n, c):
    global pass_, fail
    if c: pass_ += 1; print(" OK  " + n)
    else: fail += 1; print("FAIL " + n)

REG = "500255622398_500127886611_500255674847_500255674848-20260531.xls"
ACT = "excel_open_ea2d2cfe22a74a92aaea.html"  # 실제 변환 오픈명(HTML 위장 → .html)
app = _App([ACT, "output.xlsx"])

# (1) 변환 오픈 → 등록명→실제명 별칭 저장
s._WB_NAME_ALIASES.clear()
s._stash_workbook_name_alias(app, REG, ACT)
ck("변환 시 별칭 저장됨", bool(s._WB_NAME_ALIASES))

# (2) VBA 의 Workbooks("등록명.xls") → 실제명(.html) 으로 치환, 시트명은 보존
code = 'Set wb = Workbooks("' + REG + '")\nSet ws = wb.Worksheets("excel_open_ea2d2cfe22a74a92aaea")'
out = s._normalize_vba_workbook_literals(app, code)
ck("Workbooks 등록명 → 실제명 치환", ('Workbooks("' + ACT + '")') in out)
ck("시트명은 안 건드림(이미 실제명)", 'Worksheets("excel_open_ea2d2cfe22a74a92aaea")' in out)

# (3) 회귀: 이름 동일(일반 .xlsx, 변환 없음)이면 별칭 미저장 + 치환 안 함
s._WB_NAME_ALIASES.clear()
s._stash_workbook_name_alias(app, "output.xlsx", "output.xlsx")
ck("[회귀] 이름 동일이면 별칭 미저장", not s._WB_NAME_ALIASES)
ck("[회귀] 정상 .xlsx 리터럴 그대로", 'Workbooks("output.xlsx")' in s._normalize_vba_workbook_literals(app, 'Workbooks("output.xlsx")'))

# (4) 안전: 별칭의 실제명이 실제로 열려있지 않으면 치환하지 않음(스테일/모호 차단)
s._WB_NAME_ALIASES.clear()
s._stash_workbook_name_alias(app, REG, "excel_open_NOTOPEN.html")
ck("[안전] 별칭 실제명 미오픈 → 치환 안 함", ('Workbooks("' + REG + '")') in s._normalize_vba_workbook_literals(app, code))

# (5) 기존 동작 보존: URL 인코딩(%20) 정규화 치환은 그대로
s._WB_NAME_ALIASES.clear()
appx = _App(["my report.xlsx"])
ck("[기존] URL(%20) 정규화 치환 유지",
   'Workbooks("my report.xlsx")' in s._normalize_vba_workbook_literals(appx, 'Workbooks("my%20report.xlsx")'))

# (6) [리뷰#6] 같은 위장파일 재오픈으로 별칭 set 이 누적(len>1)돼도, '현재 열린' actual 만 필터해 해석한다.
s._WB_NAME_ALIASES.clear()
s._stash_workbook_name_alias(app, REG, "excel_open_OLD.html")  # 이전 open(이미 닫힘)
s._stash_workbook_name_alias(app, REG, ACT)                    # 현재 open (app.Workbooks 에 존재)
ck("[리뷰#6] 누적 별칭이라도 '현재 열린' 실제명으로 해석",
   ('Workbooks("' + ACT + '")') in s._normalize_vba_workbook_literals(app, code))

# (7) [리뷰#6] 누적인데 열린 actual 이 0개(전부 닫힘)면 치환 안 함(안전).
s._WB_NAME_ALIASES.clear()
s._stash_workbook_name_alias(app, REG, "excel_open_OLD1.html")
s._stash_workbook_name_alias(app, REG, "excel_open_OLD2.html")
ck("[리뷰#6] 누적인데 전부 미오픈 → 치환 안 함",
   ('Workbooks("' + REG + '")') in s._normalize_vba_workbook_literals(app, code))

# (8) 저장 스킬이 예전 HTML 임시 시트명(excel_open_<hash>)을 들고 있고, 재실행 시
# Excel 이 xlsb/html 로 다시 열며 실제 자동 시트명이 달라진 경우: 열린 자동 시트가 정확히 1개면 치환.
OLD_SHEET = "excel_open_73f4530f99525d3d8d84"
NEW_SHEET = "excel_open_48cb06049aca3c6c3a2d"
app_sheet = _App([(ACT, [NEW_SHEET])])
sheet_code = 'For Each sh In wb.Worksheets: If sh.Name = "' + OLD_SHEET + '" Then Set ws = sh: Next sh'
ck("[시트별칭] stale excel_open 시트명 → 현재 자동 시트명 치환",
   ('"' + NEW_SHEET + '"') in s._normalize_vba_workbook_literals(app_sheet, sheet_code))

# (9) 자동 시트가 여러 개면 모호하므로 치환하지 않는다.
app_amb = _App([(ACT, [NEW_SHEET]), ("other.xlsx", ["excel_open_aaaaaaaaaaaaaaaaaaaa"])])
ck("[시트별칭 안전] 자동 시트가 여러 개면 치환 안 함",
   ('"' + OLD_SHEET + '"') in s._normalize_vba_workbook_literals(app_amb, sheet_code))

# (10) Real replay shape: converted workbook names also start with excel_open_*
# and have an extension. The sheet-alias pass must not rewrite workbook literals.
ACT_XLSB = "excel_open_73f4530f99525d3d8d84234749cf027a4819a5f0afecae056aaa.xlsb"
app_replay = _App([(ACT_XLSB, [NEW_SHEET])])
s._WB_NAME_ALIASES.clear()
s._stash_workbook_name_alias(app_replay, REG, ACT_XLSB)
replay_code = (
    'If wb.Name = "' + REG + '" Then Exit For\n'
    'If sh.Name = "' + OLD_SHEET + '" Then Set ws = sh'
)
replay_out = s._normalize_vba_workbook_literals(app_replay, replay_code)
ck("[replay] workbook excel_open*.xlsb literal remains workbook name",
   ('wb.Name = "' + ACT_XLSB + '"') in replay_out)
ck("[replay] stale sheet literal resolves separately",
   ('sh.Name = "' + NEW_SHEET + '"') in replay_out)

print("\n=== RESULT: %d PASS / %d FAIL ===" % (pass_, fail))
sys.exit(2 if fail else 0)

# -*- coding: utf-8 -*-
# [회귀] 서버 VBA 보안 게이트(_vba_security_scan) — 녹화에 박힌 Workbooks.Open/SaveAs/Close/
# Shell/Kill 등이 실행 PC 에서 그대로 실행되는 것을 주입 전에 차단(오탐 방지 포함 16케이스).
# 실행: python diagnostics/_test_vba_security_scan.py  (cwd 무관, cp949 콘솔 안전)
import re, sys, io, os
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = io.open(os.path.join(_ROOT, 'serve_b2b.py'), encoding='utf-8').read()
start = src.index('_VBA_FORBIDDEN_BARE')
end = src.index('def _validate_vba_source_before_inject')
ns = {'re': re}
exec(src[src.rindex('\n# [VBA 보안 게이트]', 0, start):end], ns)
scan = ns['_vba_security_scan']
cases = [
 ('Sub B2BSkill()\n  Workbooks.Open Filename:="C:' + r'\Users\him' + '\\발주서.xlsx"\nEnd Sub', True),
 ('Sub B2BSkill()\n  ActiveWorkbook.SaveAs "C:' + r'\tmp\x.xlsx' + '"\nEnd Sub', True),
 ('Sub B2BSkill()\n  Workbooks("a.xlsx").Close False\nEnd Sub', True),
 ('Sub B2BSkill()\n  Shell "cmd /c calc"\nEnd Sub', True),
 ('Sub B2BSkill()\n  Kill "C:' + r'\tmp\*.xlsx' + '"\nEnd Sub', True),
 ('Sub B2BSkill()\n  Set fso = CreateObject("Scripting.FileSystemObject")\nEnd Sub', True),
 ('Sub B2BSkill()\n  ActiveSheet.PrintOut\nEnd Sub', True),
 ('Sub B2BSkill()\n  Application.SendKeys "{ENTER}"\nEnd Sub', True),
 # 허용
 ('Sub B2BSkill()\n  Range("A1").Value = "Shell 주유소"\nEnd Sub', False),
 ("Sub B2BSkill()\n  ' Workbooks.Open 은 쓰지 말 것\n  Range(\"A1\").Copy\nEnd Sub", False),
 ('Sub B2BSkill()\n  Set d = CreateObject("Scripting.Dictionary")\nEnd Sub', False),
 ('Sub B2BSkill()\n  ActiveWorkbook.Save\nEnd Sub', False),
 ('Sub B2BSkill()\n  Windows("input_v056_a.xlsx").Activate\n  Range("A1:G13").Copy\nEnd Sub', False),
 ('Sub B2BSkill()\n  Application.CutCopyMode = False\n  myShell = 1\nEnd Sub', False),
 ('Sub B2BSkill()\n  Selection.AutoFill Destination:=Range("J1:J13"), Type:=xlFillDefault\nEnd Sub', False),
 ('Sub B2BSkill()\n  Sheets.Add After:=ActiveSheet\n  Sheets("요약").Select\nEnd Sub', False),
]
ok = 0
for code, expect_block in cases:
    got = scan(code)
    blocked = got is not None
    if blocked == expect_block:
        ok += 1
        tag = 'PASS'
    else:
        tag = 'FAIL'
    line1 = code.splitlines()[1].strip()[:52]
    print('%s %s | %s%s' % (tag, 'BLOCK' if blocked else 'allow', line1, (' -> ' + got[:28]) if got else ''))
# [// 주석 교정] LLM 이 섞은 C 계열 주석(VBA 컴파일 오류 → 숨김 인스턴스 VBE 모달 영구블록,
# 실측 14:45 의도 반영 코드) — 줄머리는 자동 변환, 중간은 검증 거부 대상.
norm = ns['_normalize_vba_llm_comment_slips']
strip = ns['_vba_strip_strings_and_comments']
total = len(cases) + 3
f1 = norm("Sub B2BSkill()\n    // c주석\n    Dim r As Long\nEnd Sub")
if "//" not in strip(f1) and "' c주석" in f1:
    ok += 1; print("PASS N1 줄머리 // 변환")
else:
    print("FAIL N1")
if "//" in strip(norm("Sub B2BSkill()\n    x = 1 // mid\nEnd Sub")):
    ok += 1; print("PASS N2 중간 // 검증 거부 대상")
else:
    print("FAIL N2")
if "//" not in strip(norm('Sub B2BSkill()\n    Range("A1").Value = "http://a.com"\nEnd Sub')):
    ok += 1; print("PASS N3 문자열 // 오탐 없음")
else:
    print("FAIL N3")
print('%d/%d PASS' % (ok, total))
sys.exit(0 if ok == total else 1)

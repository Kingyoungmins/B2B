# -*- coding: utf-8 -*-
# [회귀] 레코더 sanitize — 죽은 타이핑 중간산물 제거(수식 자동완성 잔재).
# 같은 셀 연속 대입(사이에 같은 셀 재선택/CutCopyMode/빈 줄만)의 앞 대입은 재생 노이즈(#NAME?)이고,
# 분할 LLM 이 이 죽은 줄을 버리면 데이터보존 검증(b)이 분할 전체를 폐기했다(실측 10:39 1스텝).
# 실행: python diagnostics/_test_recorder_sanitize.py  (cwd 무관)
import sys, os
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)
from native_macro_recorder import sanitize_recorded_vba

pass_n = fail_n = 0
def t(name, cond):
    global pass_n, fail_n
    if cond:
        pass_n += 1; print("PASS " + name)
    else:
        fail_n += 1; print("FAIL " + name)

# 1. 실측 10:39 패턴: ="=SUM" 후 확정 수식 — 앞줄 제거
r1 = sanitize_recorded_vba("\n".join([
    '    Range("W1").Select',
    '    ActiveCell.FormulaR1C1 = "=SUM"',
    '    Range("W1").Select',
    '    Application.CutCopyMode = False',
    '    ActiveCell.FormulaR1C1 = "=SUM(RC[-2]:RC[-1])"']))
t("1 =SUM 중간산물 제거+확정 수식 보존", '"=SUM"' not in r1 and "=SUM(RC[-2]:RC[-1])" in r1)
# 2. 실측 09:53 패턴: ="=su"
r2 = sanitize_recorded_vba("\n".join([
    '    Range("L1").Select',
    '    ActiveCell.Formula2R1C1 = "=su"',
    '    Range("L1").Select',
    '    Application.CutCopyMode = False',
    '    ActiveCell.FormulaR1C1 = "=SUM(RC[-2]:RC[-1])"']))
t("2 =su 중간산물 제거", '"=su"' not in r2 and "SUM(RC" in r2)
# 3. 다른 셀 연속 입력은 보존
r3 = sanitize_recorded_vba("\n".join([
    '    Range("U1").Select',
    '    ActiveCell.FormulaR1C1 = "123"',
    '    Range("V1").Select',
    '    ActiveCell.FormulaR1C1 = "455"']))
t("3 다른 셀 연속 입력 보존", '"123"' in r3 and '"455"' in r3)
# 4. 사이에 다른 동작 있으면 보수적 보존
r4 = sanitize_recorded_vba("\n".join([
    '    Range("A1").Select',
    '    ActiveCell.FormulaR1C1 = "x"',
    '    ActiveSheet.Paste',
    '    ActiveCell.FormulaR1C1 = "y"']))
t("4 사이 동작 있으면 보존", '"x"' in r4 and '"y"' in r4)
# 5. 같은 셀 즉시 재대입도 앞줄 제거
r5 = sanitize_recorded_vba("\n".join([
    '    Range("B2").Select',
    '    ActiveCell.FormulaR1C1 = "3"',
    '    ActiveCell.FormulaR1C1 = "3월"']))
t("5 즉시 재대입 앞줄 제거", r5.count("FormulaR1C1") == 1 and "3월" in r5)

print("%d/%d PASS" % (pass_n, pass_n + fail_n))
sys.exit(1 if fail_n else 0)

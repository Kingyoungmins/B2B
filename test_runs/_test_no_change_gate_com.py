# [실측][SBAGENT-209 후속] 무변경 게이트 — 조건부 스킬의 '정상 무변경'은 성공, 오타겟 무변경은 실패 유지.
# 배경: CNS메시징 스킬 Step8('소계' 행 삭제)이 새 달 파일(소계 없음)에서 조건 미해당으로 아무것도
#       안 바꾸자, 게이트가 "아무 변경도 없습니다"로 실패 처리해 전체실행이 죽었다.
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.2")
import win32com.client as w
import serve_b2b as S

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else " got=" + repr(g)))
    if not c: fails += 1

# 고객 스킬 Step 8 원문과 동일 로직(I열 '소계' 행 삭제 — 없으면 아무것도 안 함)
STEP8 = '''
def transform(ctx):
    sheet = "sheet"
    last = ctx.used_last_row(sheet)
    if not last:
        return
    i_col_data = ctx.read(sheet, f"I1:I{last}")
    rows_to_delete = []
    for r_idx, row in enumerate(i_col_data):
        val = row[0]
        if val is not None and ctx.normalize(val) == ctx.normalize("소계"):
            rows_to_delete.append(r_idx + 1)
    if not rows_to_delete:
        return
    rows_to_delete.sort(reverse=True)
    for r in rows_to_delete:
        ctx.delete_rows(sheet, str(r))
'''

try:
    # (1) 데이터는 있으나 '소계' 없음(새 달 파일 재현) → 정상 무변경 = 성공 + noChange
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "sheet"
    ws.Range("A1:I1").Value = ("계정", "b", "c", "d", "e", "f", "g", "h", "구분")
    ws.Range("A2:I2").Value = ("339003635231", 1, 2, 3, 4, 5, 6, 7, "일반")
    ws.Range("A3:I3").Value = ("581702980619", 1, 2, 3, 4, 5, 6, 7, "일반")
    try:
        summary = S._exec_python_com_skill(app, wb, None, STEP8)
        ck("(1) 조건 미해당 무변경 → 성공", isinstance(summary, dict), summary)
        ck("(2) noChange=True 로 보고", summary.get("noChange") is True, summary)
        ck("(3) 데이터 보존(행 수 그대로)", int(ws.UsedRange.Rows.Count) == 3)
    except S.PythonComSkillError as e:
        ck("(1) 조건 미해당 무변경 → 성공", False, str(e))
    wb.Close(False)

    # (4) '소계' 있으면 실제로 지운다(조건부 동작 비회귀)
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1); ws.Name = "sheet"
    ws.Range("A1:I1").Value = ("계정", "b", "c", "d", "e", "f", "g", "h", "구분")
    ws.Range("A2:I2").Value = ("339003635231", 1, 2, 3, 4, 5, 6, 7, "소계")
    ws.Range("A3:I3").Value = ("581702980619", 1, 2, 3, 4, 5, 6, 7, "일반")
    summary = S._exec_python_com_skill(app, wb, None, STEP8)
    a2 = ws.Range("A2").Value  # 숫자 셀은 float 로 옴(581702980619.0)
    ck("(4) 소계 행 실제 삭제", a2 is not None and int(a2) == 581702980619, a2)
    ck("(5) 변경 있으면 noChange 없음", "noChange" not in summary, summary)
    wb.Close(False)

    # (6) 빈 시트(아무것도 못 읽음) 무변경 → 기존대로 실패('적용됨' 거짓 방지 유지)
    wb = app.Workbooks.Add()
    wb.Worksheets(1).Name = "sheet"
    try:
        S._exec_python_com_skill(app, wb, None, STEP8)
        ck("(6) 빈 시트 무변경 → 실패 유지", False, "no raise")
    except S.PythonComSkillError as e:
        ck("(6) 빈 시트 무변경 → 실패 유지", "아무 변경도 없습니다" in str(e), str(e))
    wb.Close(False)

    # (7) 일반 쓰기 스킬 비회귀(성공 + writes 기록)
    wb = app.Workbooks.Add()
    wb.Worksheets(1).Name = "sheet"
    summary = S._exec_python_com_skill(app, wb, None, "def transform(ctx):\n    ctx.write('sheet', 'A1', [['x']])\n")
    ck("(7) 일반 쓰기 비회귀", summary.get("writes", 0) >= 1, summary)
    wb.Close(False)
finally:
    _pid = S._excel_process_id(app)
    try: app.Quit()
    except Exception: pass
    del app
    import gc; gc.collect()
    # [좀비 방지 실측] 예외 경로에서 COM 참조가 남으면 Quit 후에도 EXCEL.EXE 가 '보이는 빈 창'으로
    # 남는다(회색 Excel — 최소화 이슈 조사 중 발견). 테스트는 항상 강제 종료로 마무리한다.
    try: S._force_kill_pid(_pid)
    except Exception: pass

print()
print("=== RESULT: " + ("ALL PASS" if fails == 0 else f"{fails} FAIL") + " ===")
sys.exit(1 if fails else 0)

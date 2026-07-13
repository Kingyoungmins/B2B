# [실측] ctx 서식 헬퍼(set_fill/set_font/set_border)를 진짜 Excel COM 에 걸어 결과를 되읽어 검증.
# 추측금지 — 실제 Excel 이 Interior.Color/Font/Borders 를 우리가 의도한 값으로 바꿨는지 확인.
import sys, os
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.0")
import win32com.client as w
import serve_b2b as S

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
fails = 0
def ck(name, cond, got=None):
    global fails
    print((" OK  " if cond else "FAIL ") + name + ("" if cond else f"  (got={got})"))
    if not cond: fails += 1
try:
    wb = app.Workbooks.Add()
    ws = wb.Worksheets(1)
    ws.Name = "T"
    for r in range(1, 5):
        for c in range(1, 4):
            ws.Cells(r, c).Value = f"v{r}{c}"
    ctx = S.PythonComSkillContext(app, wb, {})

    # 1) set_fill — 색이름 '노랑' → 65535, 헥스 '#FF0000' → 255, None → 채우기 없음
    ctx.set_fill("T", "A1:C1", "노랑")
    ck("set_fill 노랑 → Interior.Color=65535", int(ws.Range("A1").Interior.Color) == 65535, ws.Range("A1").Interior.Color)
    ctx.set_fill("T", "A2", "#FF0000")
    ck("set_fill #FF0000 → 255", int(ws.Range("A2").Interior.Color) == 255, ws.Range("A2").Interior.Color)
    ctx.set_fill("T", "A1", None)
    ck("set_fill None → 채우기 없음(ColorIndex=-4142)", int(ws.Range("A1").Interior.ColorIndex) == -4142, ws.Range("A1").Interior.ColorIndex)

    # 2) set_font — bold/italic/size/color/name
    ctx.set_font("T", "B2", size=14, bold=True, italic=True, color="빨강", name="맑은 고딕")
    ck("set_font bold", ws.Range("B2").Font.Bold == True, ws.Range("B2").Font.Bold)
    ck("set_font italic", ws.Range("B2").Font.Italic == True, ws.Range("B2").Font.Italic)
    ck("set_font size=14", float(ws.Range("B2").Font.Size) == 14.0, ws.Range("B2").Font.Size)
    ck("set_font color=빨강(255)", int(ws.Range("B2").Font.Color) == 255, ws.Range("B2").Font.Color)
    ck("set_font name", str(ws.Range("B2").Font.Name) == "맑은 고딕", ws.Range("B2").Font.Name)
    # 미지정 항목은 안 건드림(B3 는 기본 볼드 아님)
    ctx.set_font("T", "B3", size=9)
    ck("set_font size만 지정→bold 유지(False)", ws.Range("B3").Font.Bold == False, ws.Range("B3").Font.Bold)

    # 3) set_border — all(내부 포함), outline, 특정 변, none
    ctx.set_border("T", "A3:C4", style="thin", edges="all")
    ck("set_border all → top LineStyle=1(xlContinuous)", int(ws.Range("A3").Borders(8).LineStyle) == 1, ws.Range("A3").Borders(8).LineStyle)
    ctx.set_border("T", "A3:C4", style="thick", edges="bottom")
    ck("set_border bottom thick → weight=4", int(ws.Range("A4").Borders(9).Weight) == 4, ws.Range("A4").Borders(9).Weight)
    ctx.set_border("T", "A3:C4", style="none", edges="all")
    ck("set_border none → top LineStyle=-4142(none)", int(ws.Range("A3").Borders(8).LineStyle) == -4142, ws.Range("A3").Borders(8).LineStyle)

    # 4) 변경이 summary.structural 에 등록되나(적용됨 검출)
    summ = ctx.summary()
    ck("structural 에 서식 변경 등록됨", any("set_fill" in s or "set_font" in s or "set_border" in s for s in summ["structural"]), summ["structural"][:3])

    # 5) 단일 셀 all(내부선 11/12 적용불가)에도 예외 없이 사방 테두리
    ctx.set_border("T", "C2", style="medium", edges="all")
    ck("단일 셀 all → 예외없이 top LineStyle=1", int(ws.Range("C2").Borders(8).LineStyle) == 1, ws.Range("C2").Borders(8).LineStyle)

    wb.Close(False)
finally:
    app.Quit()
print(f"\n=== RESULT: {'ALL PASS' if fails==0 else str(fails)+' FAIL'} ===")
sys.exit(1 if fails else 0)

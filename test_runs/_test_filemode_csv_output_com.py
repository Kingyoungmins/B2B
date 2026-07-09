# [실측] 실행기 파일출력(outputMode:"file") 전체실행의 CSV 결과 저장 핵심.
# 프런트(pipeline.js)는 outputMode:"file" 이면 Python/VBA 무관하게 격리 배치(run_full_pipeline) 경로로 보낸다.
# 그 경로의 파일모드 저장이 CSV 에서 (1) 변경감지(Saved) (2) SaveCopyAs 결과 (3) 값 유지 하는지 검증.
import sys, os, tempfile
import win32com.client as w

app = w.DispatchEx("Excel.Application")
app.Visible = False
app.DisplayAlerts = False
tmp = tempfile.mkdtemp(prefix="b2b_filemode_")
fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else f"  got={g!r}"))
    if not c: fails += 1
try:
    p = os.path.join(tmp, "input_통화내역_2026_06.csv")
    with open(p, "w", encoding="utf-8-sig", newline="") as f:
        f.write("ID,고객,요금\nA1,홍,1000\nA2,김,5000\n")
    wb = app.Workbooks.Open(p)
    ck("열자마자 Saved=True(미변경)", bool(wb.Saved) == True, wb.Saved)
    ws = wb.Worksheets(1)
    ws.Range("E1").Value = 6000                      # 스킬 write_cell(합계) 상당
    ck("쓰기 후 Saved=False(=파일모드 변경감지 대상)", bool(wb.Saved) == False, wb.Saved)
    out = os.path.join(tmp, "결과_input_통화내역_2026_06.csv")
    wb.SaveCopyAs(out)                               # 파일모드 단일시트 저장 경로
    wb.Close(False)
    ck("결과 파일 생성됨(outputFiles 엔트리 근거)", os.path.exists(out), out)
    wb2 = app.Workbooks.Open(out)
    v = wb2.Worksheets(1).Range("E1").Value
    wb2.Close(False)
    ck("결과에 계산값(6000) 유지", int(v or 0) == 6000, v)
finally:
    try: app.Quit()
    except Exception: pass
    import shutil; shutil.rmtree(tmp, ignore_errors=True)
print(f"\n=== RESULT: {'ALL PASS' if fails==0 else str(fails)+' FAIL'} ===")
sys.exit(1 if fails else 0)

# -*- coding: utf-8 -*-
"""탭 전환 경로의 어떤 조작이 Excel 복사 마퀴(CutCopyMode)를 죽이는지 실측 이등분.
전용 인스턴스(DispatchEx) — 사용자 라이브 앱 무영향. 각 조작 전 A에서 복사 → 조작 → CutCopyMode 확인."""
import sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import win32com.client, win32gui, win32con, win32clipboard

app = win32com.client.DispatchEx("Excel.Application")
app.Visible = True
app.DisplayAlerts = False
wbA = app.Workbooks.Add(); wbB = app.Workbooks.Add()
wsA = wbA.Worksheets(1); wsB = wbB.Worksheets(1)
wsA.Range("A1").Value = "x"; wsA.Range("A2").Value = "y"
hA = int(wbA.Windows(1).Hwnd); hB = int(wbB.Windows(1).Hwnd)
console = int(win32gui.GetForegroundWindow() or 0)

def copy_in_A():
    wbA.Activate()
    wsA.Range("A1:A2").Copy()
    time.sleep(0.15)
    assert int(app.CutCopyMode or 0), "사전 복사 실패"

def check(name, fn):
    copy_in_A()
    err = ""
    try:
        fn()
    except Exception as e:
        err = " (op예외 %s)" % e
    time.sleep(0.3)
    alive = int(app.CutCopyMode or 0)
    print(("무해  " if alive else "☠킬러 ") + name + err)
    return bool(alive)

NOACT = win32con.SWP_NOACTIVATE | 0x0200 | win32con.SWP_NOSIZE  # +NOOWNERZORDER
def op_park_A():
    win32gui.SetWindowPos(hA, win32con.HWND_BOTTOM, -32000, -32000, 0, 0, NOACT)
def op_style_B():
    ex = win32gui.GetWindowLong(hB, win32con.GWL_EXSTYLE)
    win32gui.SetWindowLong(hB, win32con.GWL_EXSTYLE, (ex | 0x80) & ~0x40000)
    win32gui.SetWindowPos(hB, 0, 0, 0, 0, 0,
        win32con.SWP_NOMOVE | win32con.SWP_NOSIZE | win32con.SWP_NOZORDER |
        win32con.SWP_NOACTIVATE | 0x0200 | win32con.SWP_FRAMECHANGED)
def op_owner_B():
    win32gui.SetWindowLong(hB, -8, console)  # GWL_HWNDPARENT
def op_show_pos_B():
    win32gui.ShowWindow(hB, 8)  # SW_SHOWNA
    win32gui.SetWindowPos(hB, 0, 120, 120, 900, 560,
        win32con.SWP_NOACTIVATE | win32con.SWP_NOZORDER)
def op_winstate_B():
    wbB.Windows(1).WindowState = -4143
def op_vis_toggle_B():
    wbB.Windows(1).Visible = False
    wbB.Windows(1).Visible = True
def op_app_props():
    app.Interactive = True; app.UserControl = True
    app.EnableEvents = True; app.ScreenUpdating = True
def op_display_props():
    app.DisplayFormulaBar = True; app.DisplayStatusBar = True
    w = wbB.Windows(1)
    w.DisplayHeadings = True; w.DisplayGridlines = True
    w.DisplayWorkbookTabs = True
    w.DisplayHorizontalScrollBar = True; w.DisplayVerticalScrollBar = True
def op_activate_B():
    wbB.Activate()
def op_select_B():
    wbB.Activate(); wsB.Range("E1").Select()
def op_clip_read():
    win32clipboard.OpenClipboard()
    try:
        f = 0; got = 0
        while True:
            f = win32clipboard.EnumClipboardFormats(f)
            if not f: break
            if f == 13:  # CF_UNICODETEXT
                win32clipboard.GetClipboardData(f); got = 1
    finally:
        win32clipboard.CloseClipboard()
def op_foreground_console():
    if console: win32gui.SetForegroundWindow(console)
def op_full_present_B():
    op_park_A(); op_style_B(); op_owner_B(); op_show_pos_B()
    op_winstate_B(); op_app_props(); op_display_props()
def op_xlm_toolbar():
    app.ExecuteExcel4Macro('SHOW.TOOLBAR("Ribbon",TRUE)')

results = {}
results["1 A파킹(SetWindowPos -32000)"] = check("1 A파킹(SetWindowPos -32000)", op_park_A)
results["2 B 스타일(TOOLWINDOW+FRAMECHANGED)"] = check("2 B 스타일(TOOLWINDOW+FRAMECHANGED)", op_style_B)
results["3 B owner 지정(GWL_HWNDPARENT)"] = check("3 B owner 지정(GWL_HWNDPARENT)", op_owner_B)
results["4 B 표시+배치(SW_SHOWNA/SetWindowPos)"] = check("4 B 표시+배치(SW_SHOWNA/SetWindowPos)", op_show_pos_B)
results["5 B WindowState=xlNormal"] = check("5 B WindowState=xlNormal", op_winstate_B)
results["6 B win.Visible False→True"] = check("6 B win.Visible False→True", op_vis_toggle_B)
results["7 app 속성(Interactive 등)"] = check("7 app 속성(Interactive 등)", op_app_props)
results["8 표시 속성(FormulaBar/Headings 등)"] = check("8 표시 속성(FormulaBar/Headings 등)", op_display_props)
results["9 wbB.Activate(COM)"] = check("9 wbB.Activate(COM)", op_activate_B)
results["10 B 셀 Select(COM)"] = check("10 B 셀 Select(COM)", op_select_B)
results["11 클립보드 읽기(win32clipboard)"] = check("11 클립보드 읽기(win32clipboard)", op_clip_read)
results["12 포그라운드 호스트로(SetForegroundWindow)"] = check("12 포그라운드 호스트로(SetForegroundWindow)", op_foreground_console)
results["13 전체 전환 시퀀스(1~8 결합)"] = check("13 전체 전환 시퀀스(1~8 결합)", op_full_present_B)
results["14 [양성대조] SHOW.TOOLBAR XLM"] = check("14 [양성대조] SHOW.TOOLBAR XLM", op_xlm_toolbar)

# E2E: 복사 → 전체 전환 → B에 실제 붙여넣기 되는가
copy_in_A(); op_full_present_B()
ok = ""
try:
    wbB.Activate(); wsB.Range("E1").Select(); wsB.Paste()
    ok = "성공" if str(wsB.Range("E1").Value) == "x" else "값불일치"
except Exception as e:
    ok = "실패 %s" % e
print("E2E: 전체 전환 후 B 붙여넣기 =", ok)

try:
    wbA.Close(False); wbB.Close(False); app.Quit()
except Exception:
    pass
print("완료")

# -*- coding: utf-8 -*-
"""[질문 2026-08-31] "엑셀만 숨기면 되지 왜 프로그램 전체가 숨겨지나".

숨김 코드(_prepare_vba_macro_run_window_state)는 Excel 창과 'Excel PID 의 창'만 건드린다.
AX-Cell 본체는 다른 프로세스라 저 코드가 직접 숨길 수는 없다. 그런데 frame 모드에서
Excel 프레임은 본체 창의 **소유(owned) 창**이고 작업표시줄에서도 빠져 있다(_style_live_frame).
그래서 Excel 을 숨기는 순간 '활성 창'이 어디로 넘어가는지가 문제가 된다.

여기서는 AX-Cell 본체 대신 **진짜 Win32 창**을 하나 만들어 소유자로 물리고, 예전 숨김을
그대로 실행해서 본체 창에 무슨 일이 생기는지 잰다.
  · 본체 창이 같이 숨는가?            (숨는다면 '프로그램 전체가 내려감'이 문자 그대로 맞다)
  · 활성(포그라운드)이 본체로 돌아오는가? (안 돌아오면 다른 앱이 앞으로 나와 '내려간 것처럼' 보인다)
"""
import sys, io, tempfile, shutil, time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import openpyxl
import pythoncom; pythoncom.CoInitialize()
import win32com.client as win32
import win32gui, win32con, win32api, win32process
import serve_b2b as S

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if not cond else ""))
    if not cond:
        fails.append(name)


def make_host_window():
    """AX-Cell 본체 창 대역 — 평범한 top-level 창."""
    cls = win32gui.WNDCLASS()
    cls.lpfnWndProc = {win32con.WM_DESTROY: lambda h, m, w, l: 0}
    cls.lpszClassName = "B2BHostStandIn"
    cls.hInstance = win32api.GetModuleHandle(None)
    try:
        win32gui.RegisterClass(cls)
    except Exception:
        pass
    h = win32gui.CreateWindow(cls.lpszClassName, "AX-Cell(대역)",
                              win32con.WS_OVERLAPPEDWINDOW, 100, 100, 700, 500,
                              0, 0, cls.hInstance, None)
    win32gui.ShowWindow(h, win32con.SW_SHOW)
    win32gui.UpdateWindow(h)
    return h


def pump(n=12):
    for _ in range(n):
        win32gui.PumpWaitingMessages()
        time.sleep(0.02)


work = Path(tempfile.mkdtemp(prefix="b2b_owner_"))
NAME = "소유테스트.xlsx"
b = openpyxl.Workbook(); b.active.title = "Sheet"; b.active["A1"] = "x"
b.create_sheet("메모"); b.save(str(work / NAME))

app = None
host = None
try:
    host = make_host_window()
    app = win32.DispatchEx("Excel.Application")
    app.DisplayAlerts = False
    wb = app.Workbooks.Open(str(work / NAME))
    app.Visible = True
    pump()
    xl_hwnd = int(app.Hwnd)
    pid = S._excel_process_id(app)

    # 실제 frame 모드가 하는 것과 같은 배선: Excel 프레임을 본체 창의 '소유 창'으로 물리고
    # 작업표시줄/Alt+Tab 에서 뺀다.
    S._set_window_owner_hwnd(xl_hwnd, host)
    S._style_live_frame(xl_hwnd)
    pump()

    sess = {"app": app, "workbook": wb, "path": str(work / NAME), "openPath": str(wb.FullName),
            "name": NAME, "sourcePath": str(work / NAME), "liveEditable": True,
            "pid": pid, "nativeHostHwnd": host}

    # 소유자 읽기는 GetWindow(GW_OWNER) 로 해야 한다(GWL_HWNDPARENT 읽기는 신뢰 불가).
    owner_now = win32gui.GetWindow(xl_hwnd, win32con.GW_OWNER)
    check("배선 확인 — Excel 창이 본체 창의 소유 창이 됐다", int(owner_now) == int(host),
          (owner_now, host))
    check("본체와 Excel 은 서로 다른 프로세스다",
          win32process.GetWindowThreadProcessId(host)[1] != win32process.GetWindowThreadProcessId(xl_hwnd)[1])

    try:
        win32gui.SetForegroundWindow(xl_hwnd)   # 사용자가 Excel 쪽을 보고 있는 상태
    except Exception:
        pass
    pump()
    fg_before = win32gui.GetForegroundWindow()
    host_vis_before = bool(win32gui.IsWindowVisible(host))
    print("      [숨기기 전] 본체 보임=%s  포그라운드=%s (본체=%s, 엑셀=%s)"
          % (host_vis_before, fg_before, host, xl_hwnd))

    print("[1] 예전 숨김을 그대로 실행한다 — 본체 창에 무슨 일이 생기나")
    S._prepare_vba_macro_run_window_state(sess, app, wb)
    pump()
    host_vis_after = bool(win32gui.IsWindowVisible(host))
    fg_after = win32gui.GetForegroundWindow()
    xl_vis_after = bool(win32gui.IsWindowVisible(xl_hwnd))
    print("      [숨긴 후] 엑셀 보임=%s  본체 보임=%s  포그라운드=%s"
          % (xl_vis_after, host_vis_after, fg_after))

    check("엑셀 창은 실제로 숨는다(이게 원래 의도)", xl_vis_after is False, xl_vis_after)
    check("본체(AX-Cell) 창 자체는 숨지 않는다 — 다른 프로세스라 저 코드가 못 건드린다",
          host_vis_after is True, host_vis_after)

    # 여기가 답이다. 활성(포그라운드) 자리는 '사라진 엑셀 창'을 그대로 가리킨 채 남는다.
    # 즉 화면에 보이는 창 중에 활성인 게 하나도 없다 → Windows 가 뒤에 있던 다른 창을
    # 앞으로 올리고, 사용자 눈에는 AX-Cell 이 통째로 뒤로 밀린 것처럼 보인다.
    # (본체 창은 숨은 게 아니라 '밀린' 것이다 — 바로 위 검사에서 보임=True 로 확인됨)
    fg_is_host = int(fg_after or 0) == int(host)
    print("      → 활성 창이 본체로 넘어왔나?  %s" % ("예" if fg_is_host else "아니오"))
    check("활성 자리가 '사라진 엑셀 창'을 계속 가리킨다 = 앱이 뒤로 밀려 보이는 이유",
          int(fg_after or 0) == int(xl_hwnd), (fg_after, xl_hwnd, host))
    check("그래서 본체는 활성이 아니다(숨은 게 아니라 밀린 것)", not fg_is_host, fg_after)

    print("[2] 되돌리면 원래대로 오는가")
    S._restore_live_window(sess, app, wb)
    pump()
    print("      [되돌린 후] 엑셀 보임=%s  본체 보임=%s  포그라운드=%s"
          % (bool(win32gui.IsWindowVisible(xl_hwnd)), bool(win32gui.IsWindowVisible(host)),
             win32gui.GetForegroundWindow()))
    check("엑셀 창이 다시 보인다", bool(win32gui.IsWindowVisible(xl_hwnd)) is True)
    check("본체 창도 그대로 보인다", bool(win32gui.IsWindowVisible(host)) is True)

    print("[3] 수정 전 vs 수정 후 — 같은 조건에서 나란히 잰다")
    # 고친 코드는 '거부당했을 때만' 숨긴다. 거부가 없으면 숨김/되돌리기가 아예 호출되지 않으므로
    # 위 [1] 의 활성 자리 유실도 생기지 않는다. 그걸 실제 적용으로 확인한다.
    S.EXCEL_SESSIONS["ownr"] = sess

    def describe(h):
        try:
            cls = win32gui.GetClassName(h)
        except Exception:
            cls = "?"
        try:
            title = win32gui.GetWindowText(h)
        except Exception:
            title = "?"
        try:
            wpid = win32process.GetWindowThreadProcessId(h)[1]
        except Exception:
            wpid = 0
        who = ("본체" if h == host else ("엑셀프레임" if h == xl_hwnd else
               ("엑셀PID의 다른 창" if wpid == pid else "제3의 앱")))
        return "%s [%s] cls=%s title=%r pid=%s" % (h, who, cls, title[:40], wpid)

    def measure(mode, hide_required, cell):
        """같은 VBA 적용을 옛 방식/새 방식으로 한 번씩 돌리고 창·활성 상태를 잰다."""
        S._VBA_WINDOW_HIDE["required"] = hide_required
        try:
            win32gui.SetForegroundWindow(host)   # 사용자가 AX-Cell 을 보고 있는 상태에서 시작
        except Exception:
            pass
        pump()
        f0 = win32gui.GetForegroundWindow()
        seen_hidden = {"v": False}
        orig_inject = S._inject_and_run_vba

        def spy(a, w, code, entry):
            seen_hidden["v"] = not bool(win32gui.IsWindowVisible(int(a.Hwnd)))
            return orig_inject(a, w, code, entry)

        S._inject_and_run_vba = spy
        try:
            S._run_vba_on_session_impl(
                "ownr", 'Sub B2BSkill()\n    ThisWorkbook.Worksheets(1).Range("%s").Value = "ok"\nEnd Sub\n' % cell)
        finally:
            S._inject_and_run_vba = orig_inject
        pump()
        f1 = win32gui.GetForegroundWindow()
        print("      [%s] 실행 중 엑셀창 숨김=%s / 포그라운드 %s → %s"
              % (mode, seen_hidden["v"], describe(f0), describe(f1)))
        return seen_hidden["v"], f0, f1

    old_hidden, o0, o1 = measure("수정 전(항상 숨김)", True, "A2")
    new_hidden, n0, n1 = measure("수정 후", False, "A3")
    S._VBA_WINDOW_HIDE["required"] = False
    S.EXCEL_SESSIONS.pop("ownr", None)

    check("수정 전에는 실행 중 엑셀 창이 숨는다", old_hidden is True, old_hidden)
    check("수정 후에는 실행 중에도 엑셀 창이 안 숨는다 = 사용자가 본 '내려갔다 올라옴' 제거",
          new_hidden is False, new_hidden)
    # 포커스: 옛 방식은 Excel 을 통째로 숨긴 덕에 VBA 편집기가 아예 안 떠서 포커스가 유지됐다.
    # 창을 안 숨기면 VBComponents.Add 순간 편집기가 떠서 포커스를 가져간다(실측). 숨겨도 활성
    # 자리는 사라진 창을 계속 가리켜 앱이 밀린 것처럼 보인다 → _restore_foreground_after_vba 로
    # '우리가 뺏은 경우에만' 되돌린다. 두 방식 모두 사용자 포커스가 그대로여야 한다.
    check("수정 전에는 포커스가 그대로였다", o0 == o1, (o0, o1))
    check("수정 후에도 포커스가 그대로다(편집기에 안 뺏긴다)", n0 == n1, (n0, n1))
finally:
    try:
        if app is not None:
            for w in list(app.Workbooks):
                try: w.Close(SaveChanges=False)
                except Exception: pass
            app.Quit()
    except Exception:
        pass
    try:
        if host:
            win32gui.DestroyWindow(host)
    except Exception:
        pass
    shutil.rmtree(work, ignore_errors=True)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

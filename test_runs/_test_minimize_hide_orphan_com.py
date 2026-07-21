# [실측][회색 엑셀] 호스트 최소화(hide-all) 시 '세션에 속하지 않은 우리 소유 Excel 창'
# (격리 워커/작업사본/Quit 잔존)도 함께 숨겨지는지 — 결과 편집 후 최소화 때 워크북 0개짜리
# 회색 'Excel' 창이 화면에 남던 증상의 회귀 테스트.
import sys, time
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
import win32com.client as w
import win32gui, win32process
import serve_b2b as S

fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else " got=" + repr(g)))
    if not c: fails += 1

def onscreen_windows_of(pid):
    out = []
    def cb(hwnd, _):
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return
            _t, wpid = win32process.GetWindowThreadProcessId(hwnd)
            if int(wpid or 0) != pid:
                return
            l, t, r, b = win32gui.GetWindowRect(hwnd)
            if r > -5000 and b > -5000 and (r - l) > 50:
                out.append(hwnd)
        except Exception:
            pass
    win32gui.EnumWindows(cb, None)
    return out

# 세션 없는 '우리 소유' Excel — 격리 워커/복원 경로가 Visible=True 로 띄운 작업사본 재현.
app = w.DispatchEx("Excel.Application")
app.DisplayAlerts = False
S._track_spawned_excel_app(app)      # 실제 스폰 경로와 동일하게 등록
app.Visible = True                   # 화면에 드러난 상태(워크북 0개 = 회색 프레임)
time.sleep(0.8)
pid = S._excel_process_id(app)

try:
    before = onscreen_windows_of(pid)
    ck("(1) 사전조건: 세션 외 소유 창이 화면에 보임", len(before) >= 1, before)
    ck("(2) 세션 레지스트리엔 없음", all(s.get("pid") != pid for s in S.EXCEL_SESSIONS.values()))

    res = S.hide_all_excel_sessions()
    time.sleep(0.8)
    after = onscreen_windows_of(pid)
    ck("(3) [핵심] hide-all 후 소유 창 화면에서 사라짐", len(after) == 0, after)
    ck("(4) hide-all 정상 응답", isinstance(res, dict) and res.get("ok") is True, res)

    # 추적 안 된(=사용자 개인으로 간주되는) Excel 은 건드리지 않는다
    user_app = w.DispatchEx("Excel.Application")
    user_app.DisplayAlerts = False
    user_app.Visible = True
    time.sleep(0.8)
    user_pid = S._excel_process_id(user_app)
    try:
        S.hide_all_excel_sessions()
        time.sleep(0.8)
        ck("(5) 미추적(사용자) Excel 은 그대로 보임", len(onscreen_windows_of(user_pid)) >= 1)
    finally:
        try:
            user_app.Quit()
        except Exception:
            pass
        del user_app
finally:
    try:
        app.Quit()
    except Exception:
        pass
    del app
    import gc; gc.collect()
    time.sleep(0.6)
    for p in (pid,):
        try:
            S._force_kill_pid(p)  # 테스트 좀비 방지(실측: Quit 만으론 프로세스가 남을 수 있음)
        except Exception:
            pass

print()
print("=== RESULT: " + ("ALL PASS" if fails == 0 else f"{fails} FAIL") + " ===")
sys.exit(1 if fails else 0)

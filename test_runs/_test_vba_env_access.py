# -*- coding: utf-8 -*-
# [실측][SBAGENT-30] 매크로 보안 환경 확보 — Trust Center 플래그(AccessVBOM/VBAWarnings)와
# 러너 신뢰 위치(Trusted Location) 등록이 실제 레지스트리에 반영되는지(HKCU, 멱등).
# 배경: 보안설정 때문에 스킬(매크로 주입/실행)이 막히던 현상 — _ensure_* 가 근본 우회.
import io
import sys
from pathlib import Path as _P
sys.path.insert(0, str(_P(__file__).resolve().parents[1]))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import winreg
from pathlib import Path
import serve_b2b as S

fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else " got=" + repr(g)))
    if not c: fails += 1

def read_dword(subkey, name):
    try:
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, subkey)
        try:
            v, _t = winreg.QueryValueEx(k, name)
            return v
        finally:
            winreg.CloseKey(k)
    except Exception:
        return None

# (1) Trust Center 플래그
ck("(1) _ensure_vbom_access 성공", S._ensure_vbom_access() is True)
found = False
for ver in ("16.0", "15.0", "14.0", "12.0"):
    sec = r"Software\Microsoft\Office\%s\Excel\Security" % ver
    if read_dword(sec, "AccessVBOM") == 1 and read_dword(sec, "VBAWarnings") == 1:
        found = True
        break
ck("(2) AccessVBOM=1 + VBAWarnings=1 레지스트리 반영", found)

# (2) 러너 신뢰 위치
base = S._ensure_runner_trusted_location()
ck("(3) 신뢰 위치 디렉터리 존재", Path(base).exists(), base)
loc_ok = False
disabled_off = False
for ver in ("16.0", "15.0", "14.0", "12.0"):
    sec = r"Software\Microsoft\Office\%s\Excel\Security" % ver
    try:
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, sec + r"\Trusted Locations\B2BRunner")
        try:
            p, _t = winreg.QueryValueEx(k, "Path")
            if str(base).lower().rstrip("\\") in str(p).lower().rstrip("\\"):
                loc_ok = True
        finally:
            winreg.CloseKey(k)
    except Exception:
        continue
    if read_dword(sec + r"\Trusted Locations", "AllLocationsDisabled") == 0:
        disabled_off = True
ck("(4) B2BRunner 신뢰 위치 Path 등록", loc_ok)
ck("(5) AllLocationsDisabled=0(신뢰 위치 기능 켜짐)", disabled_off)

# (3) 멱등성 — 재호출해도 동일
ck("(6) 재호출 멱등", S._ensure_vbom_access() is True and str(S._ensure_runner_trusted_location()) == str(base))

print()
print("=== RESULT: " + ("ALL PASS" if fails == 0 else f"{fails} FAIL") + " ===")
sys.exit(1 if fails else 0)

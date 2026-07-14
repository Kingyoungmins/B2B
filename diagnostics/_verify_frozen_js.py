# exe(CArchive)에서 프런트 스크립트를 추출해 최신 변경이 들어갔는지 확인.
import os
from PyInstaller.archive.readers import CArchiveReader

EXE = os.path.join(os.path.dirname(__file__), "..", "dist", "B2B_ver0.6.0", "B2B_Server.exe")
r = CArchiveReader(os.path.abspath(EXE))

names = []
for e in r.toc:
    nm = e[-1] if isinstance(e, (list, tuple)) else e
    names.append(str(nm))

CHECKS = {
    "scripts\\click-recovery.js": ["__b2bClickRecovery", "pendClicks", "DOUBLE_MS"],
    "scripts\\debug-panel.js": ["__b2bSynthetic", "선클릭"],
    "index.html": ["click-recovery.js"],
    "serve_b2b.py": ["STARTF_FORCEOFFFEEDBACK", "_is_pid_alive"],
}

fails = 0
for target, markers in CHECKS.items():
    if target not in names:
        print("MISS 엔트리 없음:", target)
        fails += 1
        continue
    data = r.extract(target)
    if isinstance(data, tuple):
        data = data[1] if len(data) > 1 else data[0]
    if isinstance(data, str):
        data = data.encode("utf-8", "ignore")
    txt = data.decode("utf-8", "ignore")
    print("[" + target + "] len=" + str(len(txt)))
    for m in markers:
        ok = m in txt
        print(("  OK  " if ok else "  MISS ") + m)
        if not ok:
            fails += 1

print("\n=== " + ("ALL BUNDLED" if fails == 0 else str(fails) + " MISSING") + " ===")

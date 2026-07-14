# exe(CArchive)에서 scripts/debug-panel.js 를 추출해 클릭진단 마커가 들어갔는지 확인.
import os
from PyInstaller.archive.readers import CArchiveReader

EXE = os.path.join(os.path.dirname(__file__), "..", "dist", "B2B_ver0.6.0", "B2B_Server.exe")
r = CArchiveReader(os.path.abspath(EXE))

names = []
for e in r.toc:
    nm = e[-1] if isinstance(e, (list, tuple)) else e
    names.append(str(nm))

cands = [n for n in names if "debug-panel" in n]
print("debug-panel entries:", cands)

target = cands[0] if cands else None
if not target:
    print("scripts js sample:", [n for n in names if n.endswith(".js")][:8])
else:
    data = r.extract(target)
    if isinstance(data, tuple):
        data = data[1] if len(data) > 1 else data[0]
    if isinstance(data, str):
        data = data.encode("utf-8", "ignore")
    txt = data.decode("utf-8", "ignore")
    for m in ["__b2bClickProbe", "NOCLICK-정지", "클릭 진단"]:
        print(("  OK  " if m in txt else "MISS ") + m)
    print("len =", len(txt))

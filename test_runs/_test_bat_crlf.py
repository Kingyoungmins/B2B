# -*- coding: utf-8 -*-
"""[교훈 53 재발 방지] 빌드 배치파일(.bat)은 반드시 CRLF 여야 한다.

cmd.exe 는 LF 만 있는 .bat 의 줄을 제대로 못 끊어, 인용부호가 이어붙은 채 실행돼
'""' is not recognized 로 죽는다(싱글빌드 실패 2회 실측: 0.7.5 c3f980a9, 0.8.0 버전 bump).
파이썬 read_text/write_text(newline="") 조합이 CRLF 를 LF 로 바꾸는 게 반복 원인 —
.bat 은 항상 read_bytes/write_bytes 로 다룰 것.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
fails = 0
for p in sorted(ROOT.glob("*.bat")):
    b = p.read_bytes()
    lf = b.count(b"\n")
    crlf = b.count(b"\r\n")
    ok = lf == 0 or crlf == lf
    print(("  PASS  " if ok else "  FAIL  ") + p.name + f"  (CRLF {crlf} / LF {lf})")
    if not ok:
        fails += 1
        print("        → 고치기: read_bytes 후 b.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')")

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)

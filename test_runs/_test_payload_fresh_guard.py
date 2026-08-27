# -*- coding: utf-8 -*-
"""[실측 2026-08-26] 단일 exe 가 '어제 빌드된 패키지'를 감싸고도 성공으로 끝난 사고의 재발 방지.

build_single_exe.bat 은 dist\\B2B_ver<버전>\\ 결과물을 zip 으로 묶어 C# 래퍼에 심기만 한다.
'파일이 있는가'만 확인하므로, 소스를 고친 뒤 build_exe.bat 없이 돌리면 옛 B2B_Server.exe 를
그대로 감싼 채 "Build complete" 로 끝난다 — 실행해 보기 전엔 모른다.

여기서 잠그는 것: 가드(tools/check_payload_fresh.py)가
  · 소스보다 새 패키지는 통과시키고(0)
  · 소스보다 오래된 패키지는 막고(1)
  · 인자 없이도 동작하며(회귀 러너는 인자를 안 넘긴다)
  · build_single_exe.bat 에 실제로 연결돼 있는가
를 확인한다. '지금 dist 가 최신인가'는 검사하지 않는다 — 그건 회귀가 아니라 그때그때의 빌드 상태다.
"""
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUARD = ROOT / "tools" / "check_payload_fresh.py"
BAT = ROOT / "build_single_exe.bat"

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if not cond else ""))
    if not cond:
        fails.append(name)


def run_guard(pkg_dir=None):
    cmd = [sys.executable, str(GUARD)] + ([str(pkg_dir)] if pkg_dir else [])
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", cwd=str(ROOT))
    return r.returncode, (r.stdout or "") + (r.stderr or "")


print("[1] 가드가 존재하고 빌드에 연결돼 있다")
check("가드 파일", GUARD.exists(), GUARD)
bat = BAT.read_bytes().decode("utf-8-sig", errors="replace") if BAT.exists() else ""
check("build_single_exe.bat 이 가드를 호출한다", "check_payload_fresh.py" in bat)
check("가드가 실패하면 빌드를 멈춘다", "if errorlevel 1" in bat and "exit /b 1" in bat)
check(".bat 이 CRLF 를 유지한다(cmd 는 LF 로 깨진다)",
      BAT.exists() and BAT.read_bytes().count(b"\r\n") > 0
      and BAT.read_bytes().count(b"\n") == BAT.read_bytes().count(b"\r\n"))

print("[2] 오래된 패키지를 막는다 (이 사고의 핵심)")
tmp = Path(tempfile.mkdtemp(prefix="stale_pkg_"))
try:
    fake = tmp / "B2B_Server.exe"
    fake.write_bytes(b"dummy")
    old = time.time() - 86400 * 2          # 이틀 전 빌드로 가장
    os.utime(fake, (old, old))
    code, out = run_guard(tmp)
    check("오래된 패키지 → 실패(exit 1)", code == 1, "exit=%s / %s" % (code, out))
    check("왜 막혔는지 사람이 읽을 수 있게 말해 준다",
          "패키지가 소스보다 오래됐습니다" in out and "build_exe.bat" in out, out)
finally:
    for f in tmp.glob("*"):
        try: f.unlink()
        except Exception: pass
    try: tmp.rmdir()
    except Exception: pass

print("[3] 최신 패키지는 통과시킨다")
tmp2 = Path(tempfile.mkdtemp(prefix="fresh_pkg_"))
try:
    fresh = tmp2 / "B2B_Server.exe"
    fresh.write_bytes(b"dummy")
    later = time.time() + 3600             # 어떤 소스보다도 새 것으로 가장
    os.utime(fresh, (later, later))
    code, out = run_guard(tmp2)
    check("최신 패키지 → 통과(exit 0)", code == 0, "exit=%s / %s" % (code, out))
finally:
    for f in tmp2.glob("*"):
        try: f.unlink()
        except Exception: pass
    try: tmp2.rmdir()
    except Exception: pass

print("[4] 인자 없이도 동작한다 (회귀 러너는 인자를 안 넘긴다)")
code, out = run_guard()
check("인자 없이 실행해도 죽지 않는다(0 또는 1)", code in (0, 1), "exit=%s / %s" % (code, out))
check("무엇을 봤는지 말해 준다", ("패키지" in out) or ("SKIP" in out), out)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

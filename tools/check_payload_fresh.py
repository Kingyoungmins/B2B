# -*- coding: utf-8 -*-
"""build_single_exe.bat 이 '오래된 패키지'를 감싸는 것을 막는다.

왜(2026-08-26 실측):
  build_single_exe.bat 은 dist\\B2B_ver<버전>\\ 안의 결과물을 zip 으로 묶어 C# 래퍼에 넣기만 한다.
  존재 여부만 확인하므로, 소스를 고친 뒤 build_exe.bat 없이 이걸 돌리면 **어제 빌드된 백엔드**를
  그대로 감싼 채 "Build complete" 로 성공한다. 실제로 그날 고친 내용이 하나도 없는 exe 가 나왔고,
  실행해 보기 전까지는 알 수 없었다(배포 직전에 발견되는 종류의 사고).

무엇을 보나:
  패키지 안 B2B_Server.exe 의 수정 시각 vs 실행에 들어가는 소스(serve_b2b.py, scripts/*.js,
  *.html, native/*.cs)의 최신 수정 시각. 소스가 더 새로우면 실패시킨다.

사용: python tools/check_payload_fresh.py <패키지폴더>
"""
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 실행 결과에 실제로 들어가는 것들만(문서·테스트는 제외 — 그걸로 빌드를 막을 이유가 없다)
SOURCE_GLOBS = ["serve_b2b.py", "launch_b2b.py", "*.html", "scripts/*.js", "native/*.cs", "native/*.csproj"]
SLACK_SEC = 60          # 같은 빌드 회차 안의 미세한 시각차는 봐준다


def newest_source():
    best = None
    for pat in SOURCE_GLOBS:
        for f in ROOT.glob(pat):
            try:
                if not f.is_file():
                    continue
                m = f.stat().st_mtime
            except OSError:
                continue
            if best is None or m > best[0]:
                best = (m, f)
    return best


def main():
    # [정정 2026-08-27] 회귀 러너(tools/issue_recheck)는 스크립트에 인자를 넘기지 않는다
    # — 인자를 요구하면 '파일 없음'으로 조용히 실패해 검사가 죽어 있는 것과 같아진다.
    # 인자가 없으면 dist 에서 패키지 폴더를 스스로 찾는다.
    if len(sys.argv) < 2:
        cands = sorted((d for d in (ROOT / "dist").glob("B2B_ver*")
                        if d.is_dir() and (d / "B2B_Server.exe").exists()),
                       key=lambda d: (d / "B2B_Server.exe").stat().st_mtime)
        if not cands:
            print("[SKIP] dist 에 빌드된 패키지가 없습니다 — 검사 생략.")
            return 0
        pkg = cands[-1]
    else:
        pkg = Path(sys.argv[1])
    if not pkg.is_absolute():
        pkg = ROOT / pkg
    server = pkg / "B2B_Server.exe"
    if not server.exists():
        print("[ERROR] 패키지에 B2B_Server.exe 가 없습니다: %s" % server)
        return 2
    built = server.stat().st_mtime
    newest = newest_source()
    if not newest:
        print("[WARN] 비교할 소스를 찾지 못해 신선도 검사를 건너뜁니다.")
        return 0
    src_m, src_f = newest
    fmt = lambda t: time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t))
    if src_m > built + SLACK_SEC:
        print("[ERROR] 패키지가 소스보다 오래됐습니다 — 이대로 묶으면 오늘 수정이 없는 exe 가 나옵니다.")
        print("        패키지 B2B_Server.exe : %s" % fmt(built))
        print("        최신 소스             : %s  (%s)" % (fmt(src_m), src_f.relative_to(ROOT)))
        print("        먼저 build_exe.bat 을 실행하세요.")
        return 1
    print("[OK] 패키지가 최신 소스 이후에 빌드됨 (패키지 %s / 소스 %s)" % (fmt(built), fmt(src_m)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

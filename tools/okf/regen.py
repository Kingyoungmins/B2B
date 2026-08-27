#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OKF 전체 재생성 드라이버 — 레포의 모든 소스(py/js/cs) → docs/okf/.

버전은 build_exe.bat 의 APP_VERSION 에서 자동 파싱한다(버전업 시 그대로 따라옴).
버전업/릴리즈 훅에서 이 스크립트를 호출하면 OKF 가 항상 코드와 동기화된다.

사용:  python tools/okf/regen.py [--out docs/okf]
"""
import subprocess, sys, re, argparse, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]   # <repo>/tools/okf/regen.py → <repo>
GEN = Path(__file__).resolve().parent / "okf_gen.py"


def app_version():
    bat = ROOT / "build_exe.bat"
    if bat.exists():
        m = re.search(r'APP_VERSION=([0-9][\w.]*)', bat.read_text(encoding="utf-8-sig", errors="replace"))
        if m:
            return m.group(1)
    return "0.0.0"


def sources():
    """명세 대상 소스. 루트의 파이썬 모듈 전체 + scripts/*.js + native_host/*.cs.

    [실측 2026-08-27] 예전엔 파이썬을 serve_b2b.py 하나만 넣었다. 그래서 **secure_doc.py
    (문서보안 전체)가 OKF 에 아예 없었다** — 보안 판정·해제·재적용이 명세에 없는 상태로
    한참을 갔다. 없는 줄도 몰랐던 게 문제라, 이제 루트의 .py 를 통째로 훑는다.
    """
    src = []
    if (ROOT / "serve_b2b.py").exists():
        src.append(ROOT / "serve_b2b.py")          # 가장 큰 모듈은 앞에
    src += [p for p in sorted(ROOT.glob("*.py"))
            if p.name != "serve_b2b.py" and not p.name.startswith(("test_", "_"))]
    src += sorted((ROOT / "scripts").glob("*.js"))
    nh = ROOT / "native_host"
    if nh.exists():
        src += sorted(nh.glob("*.cs"))
    return [str(p) for p in src]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "docs" / "okf"))
    args = ap.parse_args()
    ver = app_version()
    srcs = sources()
    print(f"[OKF] version={ver}, sources={len(srcs)}개")
    # [결정성] 먼저 출력 폴더를 비운다 — 안 그러면 함수 삭제/라인시프트(__L 접미사 변화) 때 옛 문서가
    # orphan 으로 남아 check_okf 가 계속 어긋난다고 경고한다. (out 은 항상 docs/okf 전용이라 안전)
    shutil.rmtree(args.out, ignore_errors=True)
    cmd = [sys.executable, str(GEN), *srcs, "--out", args.out, "--version", ver]
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())

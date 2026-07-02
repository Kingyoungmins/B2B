#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OKF 전체 재생성 드라이버 — 레포의 모든 소스(py/js/cs) → docs/okf/.

버전은 build_exe.bat 의 APP_VERSION 에서 자동 파싱한다(버전업 시 그대로 따라옴).
버전업/릴리즈 훅에서 이 스크립트를 호출하면 OKF 가 항상 코드와 동기화된다.

사용:  python tools/okf/regen.py [--out docs/okf]
"""
import subprocess, sys, re, argparse
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
    src = []
    if (ROOT / "serve_b2b.py").exists():
        src.append(ROOT / "serve_b2b.py")
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
    cmd = [sys.executable, str(GEN), *srcs, "--out", args.out, "--version", ver]
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OKF 최신성 게이트 — 커밋된 docs/okf 가 현재 코드와 일치하는지 검사.

현재 코드로 OKF 를 임시 디렉토리에 재생성한 뒤, 커밋된 docs/okf 와 파일 단위로 비교한다.
어긋나면(코드는 바뀌었는데 OKF 는 안 갱신) 경고한다.

기본은 warn-only(개발을 막지 않음, exit 0). --strict 를 주면 불일치 시 exit 1(=CI/커밋 차단).
pre-commit / CI 에서 처음엔 warn-only 로 붙이고, 안정화 후 --strict 로 승격 권장.

사용:  python tools/okf/check_okf.py [--strict]
"""
import sys, tempfile, subprocess, argparse, shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import regen  # noqa: E402  (sources / app_version / ROOT / GEN)


def gen_to(out):
    cmd = [sys.executable, str(regen.GEN), *regen.sources(), "--out", out, "--version", regen.app_version()]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)


def rel_files(root):
    root = Path(root)
    return {str(p.relative_to(root)).replace("\\", "/"): p for p in root.rglob("*") if p.is_file()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    committed = regen.ROOT / "docs" / "okf"
    if not committed.exists():
        print("[OKF] docs/okf 없음 — 최초 생성 필요: python tools/okf/regen.py")
        return 1 if args.strict else 0

    tmp = Path(tempfile.mkdtemp(prefix="okf_check_"))
    try:
        gen_to(str(tmp))
        fresh = rel_files(tmp)
        old = rel_files(committed)
        stale, missing, orphan = [], [], []
        for rel, fp in fresh.items():
            op = committed / rel
            if not op.exists():
                missing.append(rel)
            elif fp.read_bytes() != op.read_bytes():
                stale.append(rel)
        for rel in old:
            if rel not in fresh:
                orphan.append(rel)

        total = len(stale) + len(missing) + len(orphan)
        if total == 0:
            print(f"[OKF] 최신 상태 ✓ (문서 {len(fresh)}개, 코드와 일치)")
            return 0

        def show(label, items):
            print(f"  {label}: {len(items)}")
            for x in items[:10]:
                print(f"    - {x}")
            if len(items) > 10:
                print(f"    … 외 {len(items)-10}개")

        print(f"[OKF] ⚠ 코드와 어긋난 OKF {total}건 — `python tools/okf/regen.py` 후 커밋하세요.")
        if stale:   show("변경됨(재생성 필요)", stale)
        if missing: show("누락(새 함수, 문서 없음)", missing)
        if orphan:  show("잔존(삭제된 함수 문서)", orphan)
        return 1 if args.strict else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())

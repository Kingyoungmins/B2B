#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""버전간 OKF diff — 두 _graph.json 을 비교해 '무엇이 바뀌었나'를 사실 기반으로 뽑는다.

추가/삭제 함수 + 변경(시그니처·호출관계·사이드이펙트·전역 read/write) 함수를 마크다운으로 보고한다.
회귀/영향분석 페이로드: "이 버전에서 시그니처·콜그래프·사이드이펙트가 바뀐 함수만 정확히".

사용:  python tools/okf/okf_diff.py <old/_graph.json> <new/_graph.json> [--out report.md]
"""
import json, sys, argparse


def load(p):
    return json.load(open(p, encoding="utf-8"))


def idx(g):
    return {n["id"]: n for n in g["nodes"]}


def fmt_set_change(old, new):
    o, n = set(old or []), set(new or [])
    added, removed = sorted(n - o), sorted(o - n)
    parts = []
    if added:
        parts.append("+[" + ", ".join(added) + "]")
    if removed:
        parts.append("-[" + ", ".join(removed) + "]")
    return " ".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("old")
    ap.add_argument("new")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    go, gn = load(args.old), load(args.new)
    oi, ni = idx(go), idx(gn)
    old_ids, new_ids = set(oi), set(ni)
    added = sorted(new_ids - old_ids)
    removed = sorted(old_ids - new_ids)

    changed = []
    for fid in sorted(old_ids & new_ids):
        a, b = oi[fid], ni[fid]
        diffs = {}
        if a.get("signature") != b.get("signature"):
            diffs["signature"] = f"{a.get('signature')} → {b.get('signature')}"
        for field in ("calls", "side_effects", "reads", "writes"):
            ch = fmt_set_change(a.get(field), b.get(field))
            if ch:
                diffs[field] = ch
        if diffs:
            changed.append((fid, diffs))

    out = []
    out.append(f"# OKF diff — {go.get('version')} → {gn.get('version')}")
    out.append("")
    out.append(f"- 함수 수: {len(old_ids)} → {len(new_ids)}  (추가 {len(added)}, 삭제 {len(removed)}, 변경 {len(changed)})")
    out.append("")
    if added:
        out.append("## 추가된 함수")
        out += [f"- `{x}`  ({ni[x].get('loc','')})" for x in added]
        out.append("")
    if removed:
        out.append("## 삭제된 함수")
        out += [f"- `{x}`  ({oi[x].get('loc','')})" for x in removed]
        out.append("")
    if changed:
        out.append("## 변경된 함수 (시그니처/관계/사이드이펙트)")
        for fid, diffs in changed:
            out.append(f"### `{fid}`  ({ni[fid].get('loc','')})")
            for k, v in diffs.items():
                out.append(f"- **{k}**: {v}")
            out.append("")
    if not (added or removed or changed):
        out.append("변경 없음.")

    report = "\n".join(out) + "\n"
    if args.out:
        open(args.out, "w", encoding="utf-8").write(report)
        print(f"리포트 저장: {args.out}  (추가 {len(added)}/삭제 {len(removed)}/변경 {len(changed)})")
    else:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        print(report)


if __name__ == "__main__":
    main()

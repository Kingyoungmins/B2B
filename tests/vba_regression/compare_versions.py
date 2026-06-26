#!/usr/bin/env python3
"""두 회귀 리포트(JSON)를 정량 비교해 Markdown 비교표를 만든다.

사용:
  python tests/vba_regression/compare_versions.py BASELINE.json CURRENT.json [--out OUT.md]

각 리포트는 vba_regression_runner.py 가 만든 JSON 이어야 한다(label 포함 권장).
정적 상태(NEEDS_WINDOWS/WARN/FAIL...)와 Sonnet 판정(PASS/RISK/FAIL)을
케이스/변형 단위로 맞대어, 어디서 좋아지고 나빠졌는지 표로 보여준다.
stdlib only — 모델/크레딧을 쓰지 않는다(이미 만들어진 리포트만 읽음).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any

STATIC_ORDER = ["PASS", "SKIP", "NEEDS_WINDOWS", "WARN", "FAIL"]
SONNET_ORDER = ["PASS", "RISK", "FAIL", "ERROR", None]
# 정량 점수: 높을수록 좋음(집계용). Sonnet ERROR/None 은 점수 제외.
SONNET_SCORE = {"PASS": 1.0, "RISK": 0.5, "FAIL": 0.0}


def load(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def index_results(report: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    out = {}
    for r in report.get("results", []):
        out[(r.get("case_id"), r.get("variant_id"))] = r
    return out


def count(d: dict[str, int], key: Any) -> None:
    k = key if key is not None else "—"
    d[k] = d.get(k, 0) + 1


def fmt_counts(counts: dict[str, int], order: list) -> str:
    parts = []
    for k in order:
        kk = k if k is not None else "—"
        if counts.get(kk):
            parts.append(f"{kk} {counts[kk]}")
    # order 밖의 키도 덧붙임
    for k, v in counts.items():
        if k not in [(o if o is not None else "—") for o in order]:
            parts.append(f"{k} {v}")
    return ", ".join(parts) or "—"


def sonnet_avg(report_results: list[dict[str, Any]]) -> "float | None":
    scores = []
    for r in report_results:
        v = (r.get("sonnet") or {}).get("verdict")
        if v in SONNET_SCORE:
            scores.append(SONNET_SCORE[v])
    return round(sum(scores) / len(scores), 3) if scores else None


def transition(base_v: Any, cur_v: Any, order: list) -> str:
    """좋아짐(↑)/나빠짐(↓)/동일(=) 판정. order 는 나쁜 쪽이 뒤."""
    def rank(x):
        xx = x if x is not None else "—"
        norm = [(o if o is not None else "—") for o in order]
        return norm.index(xx) if xx in norm else len(norm)
    rb, rc = rank(base_v), rank(cur_v)
    if rc < rb:
        return "개선 ↑"
    if rc > rb:
        return "악화 ↓"
    return "동일 ="


def build_markdown(base: dict[str, Any], cur: dict[str, Any]) -> str:
    bidx, cidx = index_results(base), index_results(cur)
    keys = sorted(set(bidx) | set(cidx))

    b_static: dict[str, int] = {}
    c_static: dict[str, int] = {}
    b_sonnet: dict[str, int] = {}
    c_sonnet: dict[str, int] = {}
    for k in keys:
        b = bidx.get(k, {})
        c = cidx.get(k, {})
        count(b_static, (b.get("check") or {}).get("status"))
        count(c_static, (c.get("check") or {}).get("status"))
        count(b_sonnet, (b.get("sonnet") or {}).get("verdict"))
        count(c_sonnet, (c.get("sonnet") or {}).get("verdict"))

    b_label = base.get("label") or "baseline"
    c_label = cur.get("label") or "current"
    b_savg = sonnet_avg(base.get("results", []))
    c_savg = sonnet_avg(cur.get("results", []))

    lines = [
        "# VBA Regression — 버전 정량 비교",
        "",
        f"- 기준(baseline): `{b_label}`  ·  schema: `{base.get('schema_js') or '(working tree)'}`",
        f"- 현재(current):  `{c_label}`  ·  schema: `{cur.get('schema_js') or '(working tree)'}`",
        f"- Qwen 모델: `{cur.get('model')}`  ·  Sonnet: `{cur.get('sonnet_model')}`",
        f"- 변형(variant) 수: {len(keys)}",
        "",
        "## 집계",
        "",
        "| 지표 | baseline | current |",
        "|---|---|---|",
        f"| 정적 상태 분포 | {fmt_counts(b_static, STATIC_ORDER)} | {fmt_counts(c_static, STATIC_ORDER)} |",
        f"| Sonnet 판정 분포 | {fmt_counts(b_sonnet, SONNET_ORDER)} | {fmt_counts(c_sonnet, SONNET_ORDER)} |",
        f"| 정적 FAIL 수 | {b_static.get('FAIL', 0)} | {c_static.get('FAIL', 0)} |",
        f"| Sonnet PASS 수 | {b_sonnet.get('PASS', 0)} | {c_sonnet.get('PASS', 0)} |",
        f"| Sonnet FAIL 수 | {b_sonnet.get('FAIL', 0)} | {c_sonnet.get('FAIL', 0)} |",
        f"| Sonnet 품질점수(PASS=1·RISK=.5·FAIL=0 평균) | {b_savg if b_savg is not None else '—'} | {c_savg if c_savg is not None else '—'} |",
        "",
    ]

    # 전이 분석
    improved_static = degraded_static = same_static = 0
    improved_sonnet = degraded_sonnet = same_sonnet = 0
    rows = []
    for k in keys:
        b = bidx.get(k, {})
        c = cidx.get(k, {})
        bs = (b.get("check") or {}).get("status")
        cs = (c.get("check") or {}).get("status")
        bv = (b.get("sonnet") or {}).get("verdict")
        cv = (c.get("sonnet") or {}).get("verdict")
        t_static = transition(bs, cs, STATIC_ORDER)
        t_sonnet = transition(bv, cv, SONNET_ORDER)
        improved_static += t_static.startswith("개선")
        degraded_static += t_static.startswith("악화")
        same_static += t_static.startswith("동일")
        improved_sonnet += t_sonnet.startswith("개선")
        degraded_sonnet += t_sonnet.startswith("악화")
        same_sonnet += t_sonnet.startswith("동일")
        rows.append((k, bs, cs, t_static, bv, cv, t_sonnet))

    lines += [
        "## 전이 요약 (baseline → current)",
        "",
        f"- 정적: 개선 {improved_static} · 악화 {degraded_static} · 동일 {same_static}",
        f"- Sonnet: 개선 {improved_sonnet} · 악화 {degraded_sonnet} · 동일 {same_sonnet}",
        "",
        "## 케이스/변형별 비교",
        "",
        "| case / variant | 정적(B→C) | Δ | Sonnet(B→C) | Δ |",
        "|---|---|---|---|---|",
    ]
    for (k, bs, cs, ts, bv, cv, tv) in rows:
        name = f"{k[0]} / {k[1]}"
        lines.append(
            f"| {name} | {bs or '—'} → {cs or '—'} | {ts} | {bv or '—'} → {cv or '—'} | {tv} |"
        )
    lines.append("")

    # 악화 항목만 따로 강조
    regressions = [(k, bs, cs, bv, cv) for (k, bs, cs, ts, bv, cv, tv) in rows
                   if ts.startswith("악화") or tv.startswith("악화")]
    if regressions:
        lines += ["## ⚠️ 악화(회귀) 항목", ""]
        for (k, bs, cs, bv, cv) in regressions:
            lines.append(f"- `{k[0]} / {k[1]}`: 정적 {bs}→{cs}, Sonnet {bv}→{cv}")
        lines.append("")
    else:
        lines += ["## ⚠️ 악화(회귀) 항목", "", "- 없음", ""]

    return "\n".join(lines)


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("baseline_json")
    p.add_argument("current_json")
    p.add_argument("--out", default=None)
    args = p.parse_args(argv)
    base = load(args.baseline_json)
    cur = load(args.current_json)
    md = build_markdown(base, cur)
    if args.out:
        Path(args.out).write_text(md, encoding="utf-8")
        print(f"[COMPARE] wrote {args.out}")
    else:
        print(md)
    return 0


if __name__ == "__main__":
    import sys
    raise SystemExit(main(sys.argv[1:]))

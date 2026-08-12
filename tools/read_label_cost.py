# -*- coding: utf-8 -*-
"""[진단] 사내 보안 라벨(MIP)이 어디서 붙고, 그게 얼마나 비싼지 로그로 답한다.

쓰는 법
    python tools/read_label_cost.py [로그폴더 또는 vba_pipeline_trace.jsonl]
    (기본 위치: %LOCALAPPDATA%\\B2B_logs)

답해 주는 것
  1. 라벨이 '물려받은 것'인가 '저장할 때 새로 붙는 것'인가
       원본 none → 사본 label/encrypted  = 저장하며 새로 붙음(저장 방식을 바꿀 값어치 있음)
       원본도 label/encrypted            = 문서에 이미 있음(어떤 방식으로 써도 따라옴)
  2. 스냅샷 저장이 라벨 유무에 따라 얼마나 차이 나는가
  3. 되돌리기(다시 열기)가 라벨 때문에 느려지는가  ← 체감 지연의 정체
"""
import json
import os
import statistics
import sys
from pathlib import Path

KIND_KO = {
    "none": "없음",
    "label": "라벨",
    "encrypted": "암호화",
    "legacy-ole": "구형xls",
    "": "판별못함",
}
SAVE_EVENTS = ("excel.save.snapshot", "pipeline.step.snapshot.saved", "fullrun.step.snapshot.saved")


def load(paths):
    rows = []
    for p in paths:
        for line in Path(p).read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows


def stat(nums):
    if not nums:
        return "-"
    nums = sorted(nums)
    mid = nums[len(nums) // 2]
    return "n=%d 중앙 %.0fms 최대 %.0fms" % (len(nums), mid, nums[-1])


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("LOCALAPPDATA", ""), "B2B_logs")
    target = Path(arg)
    files = sorted(target.glob("*trace*.jsonl")) if target.is_dir() else ([target] if target.exists() else [])
    if not files:
        print("로그 파일을 찾지 못했습니다: %s" % target)
        return 1
    rows = load(files)

    saves = [r for r in rows if r.get("event") in SAVE_EVENTS]
    opens = [r for r in rows if r.get("event") == "excel.replace.opened"]
    uploads = [r for r in rows if r.get("event") == "upload.done"]

    if not saves and not opens and not uploads:
        print("보안 라벨 기록이 없습니다.")
        print("(이 계측은 0.7.3 부터입니다. 파일을 올리고 스킬을 한 번 실행한 뒤 다시 확인해 주세요.)")
        return 0

    # 0.7.3 이전 로그에는 label 항목 자체가 없다 — '판별 실패'와 구분해서 보여 준다.
    def kind_of(row, key="label"):
        if key not in row:
            return "구버전기록"
        return KIND_KO.get(str(row.get(key, "")), "?")

    print("=" * 68)
    print("[1] 업로드한 원본에 라벨이 있었나")
    if uploads:
        for r in uploads:
            fb = " · 내용을 못 읽어 시트명을 지어냄" if str(r.get("inspectFallback", "")).lower() == "true" else ""
            print("   %-11s %6.2fMB  %s%s" % (kind_of(r), float(r.get("sizeMB") or 0), r.get("name", ""), fb))
    else:
        print("   (기록 없음)")

    print()
    print("[2] 라벨은 물려받은 것인가, 저장하며 새로 붙는 것인가  ← 핵심")
    pairs = {}
    for r in saves:
        src = str(r.get("srcLabel", ""))
        dst = str(r.get("label", ""))
        if not dst:
            continue
        pairs[(src, dst)] = pairs.get((src, dst), 0) + 1
    if pairs:
        for (src, dst), n in sorted(pairs.items(), key=lambda kv: -kv[1]):
            verdict = ""
            if src in ("none", "") and dst in ("label", "encrypted"):
                verdict = "  ← 저장할 때 새로 붙음"
            elif src == dst and dst in ("label", "encrypted"):
                verdict = "  ← 문서에 이미 있어 물려받음"
            print("   원본 %-7s → 사본 %-7s : %d건%s"
                  % (KIND_KO.get(src, "?"), KIND_KO.get(dst, "?"), n, verdict))
    else:
        print("   (스냅샷 저장 기록 없음)")

    print()
    print("[3] 스냅샷 저장 시간 — 라벨이 비용인가")
    by = {}
    for r in saves:
        by.setdefault(str(r.get("label", "")), []).append(float(r.get("ms") or 0))
    for k, v in sorted(by.items()):
        print("   %-9s %s" % (KIND_KO.get(k, "?"), stat(v)))

    print()
    print("[4] 되돌리기(다시 열기) — 체감 지연의 정체")
    byo = {}
    for r in opens:
        byo.setdefault(str(r.get("label", "")), []).append(float(r.get("openMs") or 0))
    if byo:
        for k, v in sorted(byo.items()):
            print("   %-9s %s" % (KIND_KO.get(k, "?"), stat(v)))
        vals = [x for v in byo.values() for x in v]
        if len(byo) > 1:
            plain = statistics.median(byo.get("none", [0])) if byo.get("none") else None
            lab = [x for k, v in byo.items() if k in ("label", "encrypted") for x in v]
            if plain and lab:
                print("   → 라벨 붙은 파일이 평문보다 중앙값 기준 %.1f배 느림"
                      % (statistics.median(lab) / max(plain, 1)))
    else:
        print("   (되돌리기 기록 없음)")
    print("=" * 68)
    return 0


if __name__ == "__main__":
    sys.exit(main())

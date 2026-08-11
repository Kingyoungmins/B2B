# -*- coding: utf-8 -*-
"""[진단] 단계 ON 이 '그 단계만 적용'으로 갔는지, '리셋+1단계부터 전체 재적용'으로 떨어졌는지 요약.

쓰는 법
    python tools/read_toggle_on_route.py <로그폴더 또는 runtime_load_trace.jsonl 경로>
    (로그 폴더 기본 위치: %LOCALAPPDATA%\\B2B_logs)

읽는 이벤트: pipeline.toggle_on.route
    route  = single_step(정상, 그 단계만) / full_reapply(1단계부터 전체)
    cause  = non_live_step        옛 형식 단계라 라이브에서 못 돎
             signature_missing    '지금 어디까지 적용됐는지' 기록이 비어 있음
             signature_mismatch   기록과 현재 단계 구성이 어긋남  → diff 에 무엇이 달라졌는지
             cross_file_write     켠 단계가 다른 파일에 쓰는 단계
"""
import json
import os
import sys
from pathlib import Path

CAUSE_KO = {
    "non_live_step": "옛 형식 단계(라이브 실행 불가)",
    "signature_missing": "적용 상태 기록 없음",
    "signature_mismatch": "적용 상태 기록과 어긋남",
    "cross_file_write": "켠 단계가 다른 파일에 씀",
}


def iter_events(path: Path):
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        # 서버가 클라 이벤트를 저장할 때 "client." 접두사를 붙인다(excel-mirror.js traceClientUiEvent).
        if str(obj.get("event", "")).endswith("pipeline.toggle_on.route"):
            yield obj


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("LOCALAPPDATA", ""), "B2B_logs")
    target = Path(arg)
    files = []
    if target.is_dir():
        files = sorted(target.glob("runtime_load_trace*.jsonl"))
    elif target.exists():
        files = [target]
    if not files:
        print("로그 파일을 찾지 못했습니다: %s" % target)
        return 1

    rows = []
    for f in files:
        rows.extend(iter_events(f))
    if not rows:
        print("pipeline.toggle_on.route 기록이 없습니다.")
        print("(이 계측은 0.7.3 부터입니다. 단계 스위치를 한 번 켜 본 뒤 다시 확인해 주세요.)")
        return 0

    single = [r for r in rows if (r.get("fields") or r).get("route") == "single_step"]
    full = [r for r in rows if (r.get("fields") or r).get("route") == "full_reapply"]
    print("단계 ON %d회 — 그 단계만 적용 %d회 / 1단계부터 전체 재적용 %d회" % (len(rows), len(single), len(full)))
    print()
    for r in full:
        f = r.get("fields") or r
        cause = str(f.get("cause", ""))
        print("  %s  단계 %s (%s)  원인: %s"
              % (str(r.get("ts", ""))[:19], f.get("stepIdx", "?"), f.get("stepId", ""), CAUSE_KO.get(cause, cause)))
        if f.get("diff"):
            print("      달라진 것: %s" % f["diff"])
        if str(f.get("runnerMappingChecked", "")).lower() == "true":
            print("      (실행기 파일확인이 켜진 상태였음)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

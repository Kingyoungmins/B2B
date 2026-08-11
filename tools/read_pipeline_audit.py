# -*- coding: utf-8 -*-
"""[진단] 단계 켜기/끄기와 실행을 한 줄씩 훑어, 이상한 곳을 짚어 준다.

쓰는 법
    python tools/read_pipeline_audit.py [로그폴더 또는 runtime_load_trace.jsonl]
    (기본 위치: %LOCALAPPDATA%\\B2B_logs)

무엇을 잡아내나
  1. 꺼진 단계가 실행에 섞여 들어갔는가        (pipeline.run.request 의 offSent)
     → "4단계는 꺼져 있는데 4단계가 시트에 반영되더라" 제보를 확인/반증하는 핵심 증거
  2. 단계를 껐을 때 라이브 되돌리기가 성공했는가 (pipeline.run.toggle_off 의 ok)
     → 되돌리기가 조용히 실패하면, 꺼진 단계의 결과가 시트에 그대로 남는다
  3. 단계를 켤 때 '그 단계만' 적용됐는가        (pipeline.toggle_on.route)
  4. 클라가 보낸 단계 = 백엔드가 실행한 단계인가 (sentIdx ↔ pipeline.impl.start 의 stepIdxs)

읽는 이벤트(모두 0.7.3 계측):
  client.pipeline.run.request / client.pipeline.run.toggle_off / client.pipeline.toggle_on.route
  pipeline.impl.start / pipeline.step.start / pipeline.step.error
"""
import json
import os
import sys
from pathlib import Path

OFF_ROUTE_KO = {
    "non_live_reconcile": "옛 형식 단계 → 전체 재적용으로 되돌림",
    "reconcile_no_signature": "적용 상태 기록이 없어 전체 재적용으로 되돌림",
    "fast_last_snapshot": "마지막 단계 직전 사본으로 되돌림",
    "checkpoint_rollback": "그 단계 직전 사본으로 되돌림",
    "reconcile_fallback": "사본 되돌리기 실패 → 전체 재적용으로 되돌림",
}
ON_CAUSE_KO = {
    "non_live_step": "옛 형식 단계",
    "signature_missing": "적용 상태 기록 없음",
    "signature_mismatch": "적용 상태 기록과 어긋남",
    "cross_file_write": "켠 단계가 다른 파일에 씀",
}


def load(path: Path):
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows


def field(row, key, default=""):
    f = row.get("fields") or row
    return f.get(key, default)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("LOCALAPPDATA", ""), "B2B_logs")
    target = Path(arg)
    files = []
    if target.is_dir():
        files = sorted(target.glob("*trace*.jsonl"))
    elif target.exists():
        files = [target]
    if not files:
        print("로그 파일을 찾지 못했습니다: %s" % target)
        return 1

    rows = []
    for f in files:
        rows.extend(load(f))
    rows.sort(key=lambda o: str(o.get("ts", "")))

    problems = []
    counts = {"on_single": 0, "on_full": 0, "off": 0, "off_fail": 0, "run": 0}
    print("=" * 72)
    for row in rows:
        ev = str(row.get("event", ""))
        ts = str(row.get("ts", ""))[11:19]

        if ev.endswith("pipeline.toggle_on.route"):
            route = str(field(row, "route"))
            if route == "single_step":
                counts["on_single"] += 1
                print(f"{ts}  [켜기] 단계 {field(row,'stepIdx')} — 그 단계만 적용(정상)")
            else:
                counts["on_full"] += 1
                cause = str(field(row, "cause"))
                print(f"{ts}  [켜기] 단계 {field(row,'stepIdx')} — 1단계부터 전체 재적용 · {ON_CAUSE_KO.get(cause, cause)}")
                if field(row, "diff"):
                    print(f"          달라진 것: {field(row,'diff')}")

        elif ev.endswith("pipeline.run.toggle_off"):
            counts["off"] += 1
            route = str(field(row, "route"))
            ok = str(field(row, "ok")).lower() == "true"
            mark = "성공" if ok else "실패"
            print(f"{ts}  [끄기] 단계 {field(row,'stepIdx')} — {OFF_ROUTE_KO.get(route, route)} … {mark}")
            if not ok:
                counts["off_fail"] += 1
                why = field(row, "reason") or field(row, "error")
                print(f"          ↳ {why}")
                problems.append(f"{ts} 단계 {field(row,'stepIdx')} 끄기 되돌리기 실패({route}) — 꺼진 단계 결과가 시트에 남았을 수 있음")

        elif ev.endswith("pipeline.run.request"):
            counts["run"] += 1
            mode = str(field(row, "mode"))
            sent = str(field(row, "sentIdx"))
            off_sent = str(field(row, "offSent"))
            off_live = str(field(row, "offSentVsLive"))
            print(f"{ts}  [실행] {mode} · 보낸 단계 [{sent}]"
                  + (f" · 되돌리기 생략" if str(field(row, 'skipReset')).lower() == "true" else ""))
            print(f"          단계 상태: {field(row,'steps')}")
            if off_sent:
                problems.append(f"{ts} 꺼진 단계가 실행에 섞임: {off_sent} (mode={mode})")
                print(f"          ⚠ 꺼진 단계가 실행에 섞임: {off_sent}")
            if off_live:
                problems.append(f"{ts} 화면상 꺼진 단계가 실행에 섞임: {off_live} (mode={mode})")
                print(f"          ⚠ 화면 기준으로 꺼진 단계가 섞임: {off_live}")

        elif ev == "pipeline.impl.start":
            idxs = str(field(row, "stepIdxs"))
            if idxs:
                print(f"{ts}      백엔드가 받은 단계 [{idxs}]"
                      + (" · 원본부터 리셋" if str(field(row, "reset")).lower() == "true" else ""))

        elif ev in ("pipeline.step.error", "fullrun.step.error"):
            print(f"{ts}      ✗ 단계 {field(row,'stepIdx')} 실패: {str(field(row,'error'))[:110]}")

    print("=" * 72)
    print(f"켜기 {counts['on_single'] + counts['on_full']}회(그 단계만 {counts['on_single']} / 전체 재적용 {counts['on_full']})"
          f" · 끄기 {counts['off']}회(되돌리기 실패 {counts['off_fail']}) · 실행 요청 {counts['run']}회")
    if problems:
        print("\n[의심 지점]")
        for p in problems:
            print("  - " + p)
    else:
        print("\n꺼진 단계가 실행에 섞인 기록은 없습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

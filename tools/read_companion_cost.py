# -*- coding: utf-8 -*-
"""[진단] 동반 파일 여는 비용이 '사본 뜨기'와 '파일 열기' 중 어디에 있는지 답한다.

쓰는 법
    python tools/read_companion_cost.py [로그폴더 또는 vba_pipeline_trace.jsonl]
    (기본 위치: %LOCALAPPDATA%\\B2B_logs)

왜 나누는가
    격리 실행은 다른 라이브 파일을 전부 SaveCopyAs 해서 새 Excel 에 연다.
    VM 실측에서 이게 회당 25.5초였는데, 이걸 줄이는 방법이 둘로 갈린다.

      사본 뜨기(copySec) — '안 변한 파일은 지난 사본 재사용' 캐시로 줄일 수 있다
      파일 열기(openSec) — 캐시로는 절대 안 줄어든다. Excel 인스턴스를 살려두고
                          워크북을 열어 둔 채 유지해야(=②) 줄어든다

    둘을 합쳐 놓으면 캐시 효과를 과대평가한다. 그래서 나눠 찍는다.

같이 보는 것
    되돌려쓰기(pipeline.companion.synced) 대 건너뛰기(...sync.skipped)
    — 읽기만 한 파일까지 되돌려쓰던 낭비가 실제로 줄었는지.
"""
import json
import os
import statistics
import sys
from pathlib import Path

OPEN_EVENT = "pipeline.isolated.companion.opened"
SYNC_EVENT = "pipeline.companion.synced"
SKIP_EVENT = "pipeline.companion.sync.skipped"


def _log_path(arg):
    if arg:
        p = Path(arg)
        return p if p.is_file() else p / "vba_pipeline_trace.jsonl"
    base = os.environ.get("LOCALAPPDATA") or str(Path.home())
    return Path(base) / "B2B_logs" / "vba_pipeline_trace.jsonl"


def _rows(path):
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception as err:
        print(f"로그를 못 읽었습니다: {path}\n  {err}")
        sys.exit(1)
    for line in lines:
        try:
            yield json.loads(line)
        except Exception:
            continue


def _fmt(sec):
    return f"{sec:.1f}초"


def main():
    path = _log_path(sys.argv[1] if len(sys.argv) > 1 else "")
    opens, synced, skipped = [], [], []
    for d in _rows(path):
        ev = str(d.get("event") or "")
        if ev == OPEN_EVENT:
            opens.append(d)
        elif ev == SYNC_EVENT:
            synced.append(d)
        elif ev == SKIP_EVENT:
            skipped.append(d)

    print(f"로그: {path}")
    print()
    if not opens:
        print("동반 파일을 연 기록이 없습니다.")
        print("  (이 계측은 2026-08-12 이후 빌드에만 있습니다 — copySec/openSec 필드가 없으면 옛 빌드입니다.)")
    else:
        have = [d for d in opens if d.get("copySec") is not None]
        if not have:
            print(f"동반 파일 오픈 {len(opens)}건이 있지만 시간 계측이 없습니다(옛 빌드).")
        else:
            copy_all = [float(d.get("copySec") or 0) for d in have]
            open_all = [float(d.get("openSec") or 0) for d in have]
            tot_copy, tot_open = sum(copy_all), sum(open_all)
            tot = tot_copy + tot_open
            print(f"■ 동반 파일 열기 — {len(have)}건, 합계 {_fmt(tot)}")
            if tot > 0:
                print(f"    사본 뜨기 {_fmt(tot_copy)}  ({tot_copy / tot * 100:.0f}%)  ← 캐시로 줄일 수 있는 몫")
                print(f"    파일 열기 {_fmt(tot_open)}  ({tot_open / tot * 100:.0f}%)  ← 캐시로는 안 줄어든다(인스턴스 재사용 몫)")
            print(f"    1건 중앙값: 사본 {_fmt(statistics.median(copy_all))} / 열기 {_fmt(statistics.median(open_all))}")
            print()
            print("  파일별(느린 순)")
            per = {}
            for d in have:
                nm = str(d.get("companionName") or "?")
                c, o = float(d.get("copySec") or 0), float(d.get("openSec") or 0)
                rec = per.setdefault(nm, {"n": 0, "c": 0.0, "o": 0.0, "mb": d.get("sizeMb")})
                rec["n"] += 1
                rec["c"] += c
                rec["o"] += o
                if rec["mb"] is None:
                    rec["mb"] = d.get("sizeMb")
            for nm, r in sorted(per.items(), key=lambda kv: -(kv[1]["c"] + kv[1]["o"]))[:10]:
                mb = f"{r['mb']}MB" if r["mb"] is not None else "크기?"
                print(f"    {nm}  [{mb}]  {r['n']}회 · 사본 {_fmt(r['c'])} + 열기 {_fmt(r['o'])}")
            print()
            print("  판단 기준")
            if tot > 0 and tot_copy / tot >= 0.5:
                print("    사본 뜨기가 절반 이상 — rev 캐시(안 변한 동반본은 사본 재사용)가 값어치 있다.")
            else:
                print("    파일 열기가 더 크다 — 캐시만으로는 얼마 못 줄인다. 인스턴스를 살려두고")
                print("    워크북을 열어 둔 채 유지하는 쪽(②)이 본 게임이다.")

    print()
    total_sync = len(synced) + len(skipped)
    if total_sync:
        print(f"■ 되돌려쓰기 — 실제 반영 {len(synced)}건 / 건너뜀 {len(skipped)}건")
        if skipped:
            print("    건너뛴 건 = 읽기만 한 파일. 예전엔 이것까지 전부 되돌려썼다(31MB 기준 회당 8초대).")
        else:
            print("    건너뛴 게 없다 = 추적 불가(VBA 스텝·구조 변경)라 예전처럼 전부 되돌려썼거나,")
            print("    정말로 전부 쓴 실행이다. pipeline.step.start 의 language 로 가른다.")
    else:
        print("■ 되돌려쓰기 기록 없음(동반 파일을 건드린 실행이 없었다).")


if __name__ == "__main__":
    main()

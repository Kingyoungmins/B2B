# -*- coding: utf-8 -*-
"""[SBAGENT-293 / 사용자 확정 2026-08-26] 실행 중 스냅샷을 함부로 지우지 않는다.

배경: 옛 정책은 용량 한도(256MB)에 걸리면 '방금 만든 앞 단계 스냅샷부터' 즉시 지웠다.
입력 하나가 55MB 인 실사용에서 5개면 한도를 넘겨, 한 단계만 고치고 다시 실행해도 이어실행이
못 걸리고 처음부터 8분을 돌았다(실측). 저장 비용(전체의 34%)은 치르고 결과만 버린 셈.
스냅샷은 세션 밖에서 어차피 정리되므로(정상 종료 cleanup_backend_runtime_files,
크래시 후 다음 시작 cleanup_stale_temp_artifacts) 세션 안에서는 보관한다.
지우는 건 '디스크가 진짜 위험할 때'와 '개수 상한' 뿐.
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import serve_b2b as S

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:200]) if (not cond and detail) else ""))
    if not cond:
        fails += 1


# 스냅샷 파일은 실제 경로여야 stats 가 크기를 잰다(정리 대상 판정도 그 경로 기준).
root = Path(S.BACKEND_DIR) / "pipeline_step_snapshots"
root.mkdir(parents=True, exist_ok=True)
tmpdir = Path(tempfile.mkdtemp(prefix="snapret_", dir=str(root)))


def make_snap(key, created, size_mb=1):
    d = tmpdir / key
    d.mkdir(parents=True, exist_ok=True)
    p = d / "output.xlsx"
    p.write_bytes(b"0" * (size_mb * 1024 * 1024))
    return {"key": key, "stepIdx": 1, "created": created, "files": {"output:output": str(p)}}


def reset(n=5, size_mb=1):
    S.PIPELINE_STEP_SNAPSHOTS.clear()
    for i in range(n):
        S.PIPELINE_STEP_SNAPSHOTS[f"k{i}"] = make_snap(f"k{i}", 1000 + i, size_mb)


_orig_usage = S.shutil.disk_usage
_orig_budget = S.HOUSEKEEPING_SNAPSHOT_MAX_BYTES
_orig_maxcnt = S.MAX_PIPELINE_STEP_SNAPSHOTS


class FakeUsage:
    def __init__(self, free):
        self.free = free
        self.total = free * 10
        self.used = free * 9


try:
    print("[1] 평상시 — 예산을 넘겨도 디스크가 넉넉하면 지우지 않는다(이어실행 보호)")
    reset(5, 1)
    S.HOUSEKEEPING_SNAPSHOT_MAX_BYTES = 1024          # 1KB — 일부러 예산 초과 상태
    S.shutil.disk_usage = lambda *_a, **_k: FakeUsage(500 * 1024 ** 3)   # 500GB 여유
    r = S._cleanup_pipeline_snapshots_by_limits()
    check("아무것도 안 지운다", r["removed"] == 0 and len(S.PIPELINE_STEP_SNAPSHOTS) == 5, r)
    check("보관했음을 표시(kept)", r.get("kept") is True, r)
    check("불필요한 파일 stat 을 건너뛴다(성능)", (r["before"] or {}).get("skipped") == "not-needed", r["before"])

    print("[2] 디스크가 진짜 위험 + 예산 초과 — 그때만 오래된 것부터 회수")
    reset(5, 1)                                        # 총 5MB
    S.HOUSEKEEPING_SNAPSHOT_MAX_BYTES = 3 * 1024 * 1024   # 3MB 까지만 — 일부만 회수되는 현실적 값
    S.shutil.disk_usage = lambda *_a, **_k: FakeUsage(1 * 1024 ** 3)     # 1GB 여유(위험)
    r2 = S._cleanup_pipeline_snapshots_by_limits()
    check("회수가 일어난다", r2["removed"] > 0, r2)
    check("가장 오래된 것부터 지운다(최신 접두 보존)", "k0" not in S.PIPELINE_STEP_SNAPSHOTS, list(S.PIPELINE_STEP_SNAPSHOTS))
    check("가장 최근 것은 남는다", "k4" in S.PIPELINE_STEP_SNAPSHOTS, list(S.PIPELINE_STEP_SNAPSHOTS))

    print("[3] 디스크가 위험해도 예산 안이면 지우지 않는다")
    reset(3, 1)
    S.HOUSEKEEPING_SNAPSHOT_MAX_BYTES = 100 * 1024 * 1024   # 100MB — 여유
    S.shutil.disk_usage = lambda *_a, **_k: FakeUsage(1 * 1024 ** 3)
    r3 = S._cleanup_pipeline_snapshots_by_limits()
    check("보관", r3["removed"] == 0 and len(S.PIPELINE_STEP_SNAPSHOTS) == 3, r3)

    print("[4] 개수 상한은 디스크와 무관하게 지킨다(무한 누적 방지)")
    reset(6, 1)
    S.MAX_PIPELINE_STEP_SNAPSHOTS = 3
    S.shutil.disk_usage = lambda *_a, **_k: FakeUsage(500 * 1024 ** 3)
    r4 = S._cleanup_pipeline_snapshots_by_limits()
    check("상한까지 줄인다", len(S.PIPELINE_STEP_SNAPSHOTS) <= 3, len(S.PIPELINE_STEP_SNAPSHOTS))
    check("최신은 남는다", "k5" in S.PIPELINE_STEP_SNAPSHOTS, list(S.PIPELINE_STEP_SNAPSHOTS))

    print("[5] 반환 형식 — housekeeping 이 읽는 키가 유지된다")
    check("removed 키 존재", "removed" in r4 and isinstance(r4["removed"], int))
    check("before/after 키 존재", "before" in r4 and "after" in r4)

    print("[6] 기본 예산 — 고정 256MB 가 아니라 디스크에 비례(하한 256MB·상한 4GB)")
    S.shutil.disk_usage = lambda *_a, **_k: FakeUsage(500 * 1024 ** 3)
    check("여유 500GB → 4GB 상한", S._default_snapshot_budget_bytes() == 4 * 1024 ** 3, S._default_snapshot_budget_bytes())
    S.shutil.disk_usage = lambda *_a, **_k: FakeUsage(1 * 1024 ** 3)
    check("여유 1GB → 256MB 하한", S._default_snapshot_budget_bytes() == 256 * 1024 * 1024, S._default_snapshot_budget_bytes())
    os.environ["B2B_PIPELINE_SNAPSHOT_MAX_BYTES"] = "12345"
    check("환경변수가 있으면 그 값이 이긴다", S._default_snapshot_budget_bytes() == 12345)
    os.environ.pop("B2B_PIPELINE_SNAPSHOT_MAX_BYTES", None)
finally:
    S.shutil.disk_usage = _orig_usage
    S.HOUSEKEEPING_SNAPSHOT_MAX_BYTES = _orig_budget
    S.MAX_PIPELINE_STEP_SNAPSHOTS = _orig_maxcnt
    S.PIPELINE_STEP_SNAPSHOTS.clear()
    try:
        S.shutil.rmtree(tmpdir, ignore_errors=True)
    except Exception:
        pass

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""0.5.10 유지보수 패치 비파괴 단위 테스트.
실제 Excel/앱을 안 건드림: reap 테스트는 내가 띄운 throwaway python 프로세스만 대상.
serve_b2b import 는 스레드를 안 띄움(start_runtime_maintenance_threads는 __main__ 하위, line 13806)."""
import os, sys, time, threading, subprocess, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # test_runs/ -> version root (serve_b2b.py)
sys.path.insert(0, ROOT)
import serve_b2b as s

PASS, FAIL = [], []
def check(name, cond):
    (PASS if cond else FAIL).append(name)
    print(("  OK  " if cond else " FAIL ") + name)

def spawn_sleeper():
    p = subprocess.Popen([sys.executable, "-c", "import time;time.sleep(120)"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return p

# ---- A. _sample_lock_contended: non-blocking, free=False / held=True ----
print("[A] _sample_lock_contended (non-blocking)")
check("A1 free -> not contended", s._sample_lock_contended() is False)
ev = threading.Event(); rel = threading.Event()
def holder():
    s.EXCEL_LOCK.acquire(); ev.set(); rel.wait(3);
    try: s.EXCEL_LOCK.release()
    except Exception: pass
t = threading.Thread(target=holder, daemon=True); t.start(); ev.wait(2)
t0 = time.monotonic(); contended = s._sample_lock_contended(); dt = time.monotonic()-t0
check("A2 held-by-other -> contended", contended is True)
check("A3 returns within ~0.2s (non-blocking)", dt < 0.25)
rel.set(); t.join(2)
check("A4 after release -> not contended", s._sample_lock_contended() is False)

# ---- B. reap: 고아만 죽이고 세션 PID는 보호 ----
print("[B] reap protection (throwaway procs)")
p_orphan = spawn_sleeper(); p_sess = spawn_sleeper()
time.sleep(0.3)
s.SPAWNED_EXCEL_PIDS.clear(); s.SPAWNED_EXCEL_PIDS.update({p_orphan.pid, p_sess.pid})
s.EXCEL_SESSIONS.clear(); s.EXCEL_SESSIONS["t"] = {"pid": p_sess.pid}
s.PYTHON_SKILL_APP_PID = None
s.EXCEL_LAST_REAP_AT = 0  # force should_reap
diag = s._excel_runtime_diagnostics(reap=True, log=False)
time.sleep(0.5)
orphan_dead = (p_orphan.poll() is not None) or (not s._is_pid_alive(p_orphan.pid))
sess_alive = s._is_pid_alive(p_sess.pid)
check("B1 orphan reaped", p_orphan.pid in (diag.get("reapedPids") or []))
check("B2 orphan actually dead", orphan_dead)
check("B3 session PID NOT reaped", p_sess.pid not in (diag.get("reapedPids") or []))
check("B4 session PID still alive", sess_alive)
check("B5 orphan removed from tracked", p_orphan.pid not in s.SPAWNED_EXCEL_PIDS)
check("B6 session kept in tracked", p_sess.pid in s.SPAWNED_EXCEL_PIDS)
# cleanup
for p in (p_orphan, p_sess):
    try: p.kill()
    except Exception: pass
s.SPAWNED_EXCEL_PIDS.clear(); s.EXCEL_SESSIONS.clear()

# ---- C. housekeeping 게이팅 ----
print("[C] housekeeping gating")
orig_q = s._excel_queue_size; orig_j = s._pipeline_job_stats; orig_avail = s.excel_available
# busy(queue) -> skip, no run
s._excel_queue_size = lambda: 1
rc0 = s.HOUSEKEEPING_RUN_COUNT
s._run_low_risk_housekeeping()
check("C1 busy-queue -> skip", s.HOUSEKEEPING_LAST_SKIPPED_REASON == "pipeline-or-queue-busy" and s.HOUSEKEEPING_RUN_COUNT == rc0)
# lock held by other -> skip
s._excel_queue_size = lambda: 0
s._pipeline_job_stats = lambda: {"running": 0, "total": 0}
ev2 = threading.Event(); rel2 = threading.Event()
def holder2():
    s.EXCEL_LOCK.acquire(); ev2.set(); rel2.wait(3)
    try: s.EXCEL_LOCK.release()
    except Exception: pass
t2 = threading.Thread(target=holder2, daemon=True); t2.start(); ev2.wait(2)
s._run_low_risk_housekeeping()
check("C2 lock-held -> skip", s.HOUSEKEEPING_LAST_SKIPPED_REASON == "excel-lock-busy" and s.HOUSEKEEPING_RUN_COUNT == rc0)
rel2.set(); t2.join(2)
# idle -> runs (excel_available False 로 실제 Excel 미접촉)
s.excel_available = lambda: False
s._run_low_risk_housekeeping()
check("C3 idle -> runs (RUN_COUNT+1, no error)", s.HOUSEKEEPING_RUN_COUNT == rc0 + 1 and not s.HOUSEKEEPING_ERROR)
s._excel_queue_size, s._pipeline_job_stats, s.excel_available = orig_q, orig_j, orig_avail

# ---- D. sampler 가 trace 한 줄 남기는지 ----
print("[D] sampler writes runtime_load_trace.jsonl")
s.excel_available = lambda: False
tp = s._perf_trace_path()
before = os.path.getsize(tp) if os.path.exists(tp) else 0
s._runtime_sampler_once()
after = os.path.getsize(tp) if os.path.exists(tp) else 0
last = ""
if os.path.exists(tp):
    # [2026-08-24] 앱이 멈춰 강제 종료되면 트레이스 마지막 줄이 잘려 깨진 바이트가 남는다.
    # 실제 그런 로그가 나왔다 — 검사 도구가 그걸로 죽으면 안 된다(진단 자체가 막힌다).
    with open(tp, "r", encoding="utf-8", errors="replace") as f:
        lines = f.read().strip().splitlines()
        last = lines[-1] if lines else ""
ev_ok = False
try: ev_ok = json.loads(last).get("event") == "runtime.sample"
except Exception: pass
check("D1 trace grew", after > before)
check("D2 last event == runtime.sample", ev_ok)
s.excel_available = orig_avail

# ---- E. 클립보드 throttle ----
print("[E] clipboard snapshot throttle")
calls = {"n": 0}
orig_read = s._read_excel_clipboard_source
s._read_excel_clipboard_source = lambda: (calls.__setitem__("n", calls["n"] + 1) or {"book": "x.xlsx", "sheet": "S", "range": "A1"})
class FakeApp:
    CutCopyMode = 1
fa = FakeApp()
s.LAST_COPY_SOURCE.clear()
s._maybe_snapshot_copy_source(fa)   # rising edge -> read
s._maybe_snapshot_copy_source(fa)   # throttled
s._maybe_snapshot_copy_source(fa)   # throttled
check("E1 rising edge reads once, rapid repeats throttled", calls["n"] == 1)
s.LAST_COPY_SOURCE["pollTs"] = time.monotonic() - 10  # throttle 만료
s._maybe_snapshot_copy_source(fa)
check("E2 after throttle window -> reads again", calls["n"] == 2)
fa.CutCopyMode = 0
s._maybe_snapshot_copy_source(fa)   # off -> no read
check("E3 CutCopyMode off -> no clipboard read", calls["n"] == 2 and s.LAST_COPY_SOURCE.get("cutCopyActive") is False)
s._read_excel_clipboard_source = orig_read

print("\n=== RESULT: %d PASS / %d FAIL ===" % (len(PASS), len(FAIL)))
if FAIL:
    print("FAILED:", FAIL)
sys.exit(0 if not FAIL else 2)

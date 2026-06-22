#!/usr/bin/env python3
"""Regression probe for the Excel reap race.

When EXCEL_LOCK is held, diagnostics must not reap tracked app-owned PIDs.
This uses a throwaway Python process as a stand-in for an in-flight isolated
Excel app PID, so the test can run without launching Excel.
"""

import os
import subprocess
import sys
import threading
import time


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import serve_b2b as s  # noqa: E402


def main():
    proc = subprocess.Popen(
        [sys.executable, "-c", "import time; time.sleep(120)"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.3)

    s.SPAWNED_EXCEL_PIDS.clear()
    s.SPAWNED_EXCEL_PIDS.add(proc.pid)
    s.EXCEL_SESSIONS.clear()
    s.PYTHON_SKILL_APP_PID = None
    s.EXCEL_LAST_REAP_AT = 0

    held = threading.Event()
    release = threading.Event()

    def hold_lock():
        s.EXCEL_LOCK.acquire()
        held.set()
        release.wait(4)
        try:
            s.EXCEL_LOCK.release()
        except Exception:
            pass

    thread = threading.Thread(target=hold_lock, daemon=True)
    thread.start()
    held.wait(2)

    diag = s._excel_runtime_diagnostics(reap=True, log=False)
    release.set()
    thread.join(3)
    time.sleep(0.4)

    reaped = proc.pid in (diag.get("reapedPids") or [])
    dead = (proc.poll() is not None) or (not s._is_pid_alive(proc.pid))

    print("lockUnavailable in diag:", diag.get("lockUnavailable"))
    print("reapedPids:", diag.get("reapedPids"))
    print("in-flight PID reaped:", reaped, "| dead:", dead)

    try:
        proc.kill()
    except Exception:
        pass
    s.SPAWNED_EXCEL_PIDS.clear()

    if reaped or dead:
        raise AssertionError("reap ran while EXCEL_LOCK was unavailable")

    print("reap race probe: ok")


if __name__ == "__main__":
    main()

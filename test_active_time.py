# -*- coding: utf-8 -*-
"""[0.8.4 활성시간 A안] 트레이스 타임스탬프 간격 근사 — 10분 이하 간격만 실사용으로 합산.

앱 무수정: 수집 서버가 이미 파싱하는 세션 로그의 ts 간격으로 계산(캐시 v4).
실행: python test_active_time.py
"""
import json
import sys
import tempfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import collector
import main as M
from fastapi.testclient import TestClient

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails += 1


root = Path(tempfile.mkdtemp(prefix="active_"))
collector.configure(str(root))
client = TestClient(M.app)


def line(sec, event="python_com.read"):
    return json.dumps({"ts": "2026-09-08T10:%02d:%02d" % (sec // 60, sec % 60), "event": event}) + "\n"


def make_session(user, sid, lines):
    r = client.post("/v1/logs/session/start", json={"sessionId": sid, "user": user})
    (Path(r.json()["path"]) / "logs" / "vba_pipeline_trace.jsonl").write_text("".join(lines), "utf-8")


print("[1] 간격 규칙 — 10분 이하만 합산, 초과는 자리비움(0)")
# 0s,60s,120s (2분 연속) → 20분 공백(>10분) → 1320s,1380s (1분 연속) = 활성 3분
make_session("CLOUDPC_s0min", "act-1",
             [line(0), line(60), line(120), line(1320), line(1380)])
d = client.get("/v1/admin/sessions").json()
row = {x["sessionId"]: x for x in d["sessions"]}["act-1"]
check("세션 목록 activeMinutes = 3.0 (총 23분 중 공백 20분 제외)",
      row.get("activeMinutes") == 3.0, row.get("activeMinutes"))

print("[1b] 경계 — 9분 간격은 합산, 11분 간격은 자리비움")
make_session("CLOUDPC_s0min", "act-1b", [line(0), line(540), line(540 + 660)])
d = client.get("/v1/admin/sessions").json()
row = {x["sessionId"]: x for x in d["sessions"]}["act-1b"]
check("activeMinutes = 9.0 (9분 포함, 11분 제외)", row.get("activeMinutes") == 9.0, row.get("activeMinutes"))

print("[2] 이벤트 1개뿐이면 0 (간격이 없다)")
make_session("CLOUDPC_s0min", "act-2", [line(0)])
d = client.get("/v1/admin/sessions").json()
row = {x["sessionId"]: x for x in d["sessions"]}["act-2"]
check("activeMinutes = 0", row.get("activeMinutes") == 0.0, row.get("activeMinutes"))

print("[3] ts 없는/깨진 줄은 무시하고 계산")
make_session("CLOUDPC_other", "act-3",
             [line(0), "broken{{{\n", json.dumps({"event": "no.ts"}) + "\n", line(60)])
d = client.get("/v1/admin/sessions").json()
row = {x["sessionId"]: x for x in d["sessions"]}["act-3"]
check("activeMinutes = 1.0", row.get("activeMinutes") == 1.0, row.get("activeMinutes"))

print("[4] /admin/events — 총합·사용자별·일별")
r = client.get("/v1/admin/events").json()
act = r.get("active") or {}
check("총합 13분(3+9+0+1)", act.get("minutes") == 13.0, act)
bu = {x["user"]: x["minutes"] for x in act.get("byUser") or []}
check("사용자별 — s0min 12분 / other 1분", bu.get("CLOUDPC_s0min") == 12.0 and bu.get("CLOUDPC_other") == 1.0, bu)
bd = act.get("byDate") or []
check("일별 — 오늘 13분", len(bd) == 1 and bd[0]["minutes"] == 13.0, bd)

print("[5] 캐시 v4 — 두 번째 호출은 캐시, 값 동일")
r2 = client.get("/v1/admin/events").json()
check("캐시 히트", r2["scanned"]["cached"] >= 3, r2["scanned"])
check("값 동일", (r2.get("active") or {}).get("minutes") == 13.0)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)

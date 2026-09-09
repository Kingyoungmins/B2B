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
check("총합 13분(3+9+0+1) — 4b/4c 는 아래에서 별도 검증", act.get("minutes") == 13.0, act)
bu = {x["user"]: x["minutes"] for x in act.get("byUser") or []}
check("사용자별 — s0min 12분 / other 1분", bu.get("CLOUDPC_s0min") == 12.0 and bu.get("CLOUDPC_other") == 1.0, bu)
bd = act.get("byDate") or []
check("일별 — 오늘 13분", len(bd) == 1 and bd[0]["minutes"] == 13.0, bd)

print("[4b] 세션 창 밖 기록(누적 telemetry, UTC) 은 활성·전체실행에서 제외")
# 세션 시작을 서버 '지금' 기준으로 잡으므로, 세션 창 = start(±5분). 며칠 전 UTC 기록 2개(49초 간격)는
# 실측에서 모든 세션에 +0.8분을 얹던 바로 그 패턴이다. 창 안 기록 1개만 살아남아야 한다.
import datetime as _dt
r = client.post("/v1/logs/session/start", json={"sessionId": "act-4b", "user": "CLOUDPC_win"})
sdir4 = Path(r.json()["path"])
now_utc = _dt.datetime.now(_dt.timezone.utc)
def tele(t, status="success"):
    return json.dumps({"timestamp": t.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
                       "event_type": "agent.run", "status": status, "latency_ms": 1000}) + "\n"
old1 = now_utc - _dt.timedelta(days=8); old2 = old1 + _dt.timedelta(seconds=49)
inside = now_utc + _dt.timedelta(seconds=30)
(sdir4 / "logs" / "telemetry_preview.jsonl").write_text(tele(old1) + tele(old2) + tele(inside, "failed"), "utf-8")
(sdir4 / "logs" / "vba_pipeline_trace.jsonl").write_text(line(0) + line(60), "utf-8")   # 창 안 활동 1분
d = client.get("/v1/admin/sessions").json()
row = {x["sessionId"]: x for x in d["sessions"]}["act-4b"]
check("활성 = 창 안 활동 1분(과거 49초 쌍 제외)", row.get("activeMinutes") == 1.0, row.get("activeMinutes"))
ev = client.get("/v1/admin/events").json()
fr = ev.get("fullRuns") or {}
fru = {x["user"]: x for x in fr.get("byUser") or []}
check("전체실행 — 이 세션은 1건(창 안 failed)만, 과거 2건 제외", fru.get("CLOUDPC_win", {}).get("count") == 1
      and fru.get("CLOUDPC_win", {}).get("error") == 1, fru.get("CLOUDPC_win"))
check("UTC 변환 — 창 안 판정이 Z 시각으로 정확(9시간 오차 없음)", row.get("activeMinutes") == 1.0)

print("[4c] 활성은 체류를 넘지 못한다(클램프)")
# 끝난 세션: 시작 = 지금, 끝 = +2분. 로그엔 창 안이지만 slack 덕에 들어온 +6분 활동 → 체류 2분으로 잘린다.
r = client.post("/v1/logs/session/start", json={"sessionId": "act-4c", "user": "CLOUDPC_win"})
sdir5 = Path(r.json()["path"])
st = _dt.datetime.now()
def loc(sec): return json.dumps({"ts": (st + _dt.timedelta(seconds=sec)).strftime("%Y-%m-%dT%H:%M:%S"), "event": "x"}) + "\n"
(sdir5 / "logs" / "vba_pipeline_trace.jsonl").write_text("".join(loc(i * 60) for i in range(0, 7)), "utf-8")   # 0~6분
client.post("/v1/logs/session/end", json={"sessionId": "act-4c", "user": "CLOUDPC_win",
                                         "endedAt": (st + _dt.timedelta(minutes=2)).strftime("%Y-%m-%dT%H:%M:%S"), "reason": "normal"})
d = client.get("/v1/admin/sessions").json()
row = {x["sessionId"]: x for x in d["sessions"]}["act-4c"]
check("체류 2분 세션의 활성 ≤ 2.0", row.get("activeMinutes") is not None and row["activeMinutes"] <= 2.0, row.get("activeMinutes"))

print("[5] 캐시 v6 — 두 번째 호출은 캐시, 값 동일")
r1 = client.get("/v1/admin/events").json()
r2 = client.get("/v1/admin/events").json()
check("캐시 히트", r2["scanned"]["cached"] >= 3, r2["scanned"])
check("값 동일(4b 1분 + 4c 클램프 2분 포함, 캐시 전후 일치)",
      (r2.get("active") or {}).get("minutes") == (r1.get("active") or {}).get("minutes") == 16.0,
      ((r1.get("active") or {}).get("minutes"), (r2.get("active") or {}).get("minutes")))

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)

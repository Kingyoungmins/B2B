# -*- coding: utf-8 -*-
"""[0.8.3] '수집 중' 고착 수정 — 끊김(종료 추정) 판정.

실측(2026-09-02): 대시보드에 거의 모든 세션이 "수집 중". 원인은 앱 X 종료 시
호스트가 응답 직후 서버를 kill 해 session/end 가 유실되는 레이스(앱 쪽에서 응답 전
전송으로 수정). 이미 쌓인/앞으로도 생길(크래시·전원꺼짐) 신호 유실은 서버가
'마지막 수신 후 10분 무소식'을 끊김(종료 추정)으로 판정해 흡수한다.

실행: python test_stale_sessions.py
"""
import datetime
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


root = Path(tempfile.mkdtemp(prefix="stale_"))
collector.configure(str(root))
client = TestClient(M.app)


def set_last_seen(sdir, minutes_ago):
    meta = json.loads((sdir / "session.json").read_text("utf-8"))
    meta["lastSeenAt"] = (datetime.datetime.now()
                          - datetime.timedelta(minutes=minutes_ago)).isoformat(timespec="seconds")
    (sdir / "session.json").write_text(json.dumps(meta, ensure_ascii=False), "utf-8")


print("[1] 방금 살아있는 세션 = 수집 중")
r = client.post("/v1/logs/session/start", json={"sessionId": "alive", "user": "u1"})
alive_dir = Path(r.json()["path"])
row = [x for x in client.get("/v1/admin/sessions").json()["sessions"] if x["sessionId"] == "alive"][0]
check("closed=False, stale=False", row["closed"] is False and row["stale"] is False, row)

print("[2] 10분 넘게 무소식 = 끊김(종료 추정)")
r = client.post("/v1/logs/session/start", json={"sessionId": "ghost", "user": "u1"})
set_last_seen(Path(r.json()["path"]), 15)
row = [x for x in client.get("/v1/admin/sessions").json()["sessions"] if x["sessionId"] == "ghost"][0]
check("stale=True", row["stale"] is True, row)
check("closed 는 여전히 False(추정일 뿐 확정 아님)", row["closed"] is False, row)

print("[3] 정상 종료 신호를 받은 세션 = 종료(stale 아님)")
client.post("/v1/logs/session/start", json={"sessionId": "done", "user": "u1"})
client.post("/v1/logs/session/end", json={"sessionId": "done", "user": "u1", "reason": "app.shutdown"})
row = [x for x in client.get("/v1/admin/sessions").json()["sessions"] if x["sessionId"] == "done"][0]
check("closed=True, stale=False", row["closed"] is True and row["stale"] is False, row)

print("[4] '수집 중' 카드(stats.openSessions)도 끊김을 빼고 센다")
t = client.get("/v1/admin/stats").json()["total"]
check("수집 중 = 1 (alive 만)", t["openSessions"] == 1, t)
check("총 실행은 3 그대로", t["sessions"] == 3, t)

print("[5] 무소식 9분은 아직 수집 중(전송 주기 여유)")
set_last_seen(alive_dir, 9)
row = [x for x in client.get("/v1/admin/sessions").json()["sessions"] if x["sessionId"] == "alive"][0]
check("9분은 stale 아님", row["stale"] is False, row)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)

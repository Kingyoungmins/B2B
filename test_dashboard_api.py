# -*- coding: utf-8 -*-
"""[대시보드 2026-08-24] /admin/stats · /admin/errors 집계 API 검증.

수집 API 로 실제 세션을 넣고(시작→로그→스킬→종료) 집계가 맞는지 종단으로 확인한다.
체류 시간은 endedAt 이 없으면 lastSeenAt 으로 물러난다 — 강제 종료 세션이 0분으로
사라지지 않게 하기 위해서다.

실행: python test_dashboard_api.py
"""
import base64
import json
import tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

import collector

fails = 0


def check(name, cond, detail=None):
    global fails
    if cond:
        print("  PASS  " + name)
    else:
        fails += 1
        print("  FAIL  " + name + (("  -> " + str(detail)[:160]) if detail is not None else ""))


app = FastAPI()
app.include_router(collector.router)
app.include_router(collector.admin_router)
app.include_router(collector.admin_router, prefix="/v1")   # main.py 와 같은 별칭
collector.configure(root=tempfile.mkdtemp(prefix="dash_test_"))
c = TestClient(app)
enc = lambda b: base64.b64encode(b).decode()

print("[준비] 세션 2개(사용자 2명) — 로그 + 오류 이벤트 2건 + 스킬 zip")
for user, sid, start, end in (("kim_a", "20260824-100000-1-aaaa", "2026-08-24T10:00:00", "2026-08-24T10:42:00"),
                              ("lee_b", "20260824-110000-2-bbbb", "2026-08-24T11:00:00", "2026-08-24T11:05:00")):
    assert c.post("/logs/session/start", json={"sessionId": sid, "user": user, "date": "2026-08-24",
                                               "startedAt": start, "appVersion": "0.7.5.0",
                                               "host": "VM-01"}).json()["ok"]
    lines = (json.dumps({"ts": start, "event": "pipeline.step.ok", "stepIdx": 0}) + "\n"
             + json.dumps({"ts": start, "event": "pipeline.step.error", "stepIdx": 1,
                           "stepId": "abc123", "error": "시트 'VIEW' 를 찾을 수 없습니다"}) + "\n"
             + json.dumps({"ts": start, "event": "fullrun.file.save_error", "error": "저장 실패: 잠김"}) + "\n")
    assert c.post("/logs/append", json={"sessionId": sid, "user": user, "date": "2026-08-24",
                                        "name": "vba_pipeline_trace.jsonl", "offset": 0,
                                        "encoding": "b64", "data": enc(lines.encode())}).json()["ok"]
    assert c.post("/logs/file", json={"sessionId": sid, "user": user, "date": "2026-08-24",
                                      "kind": "skill", "name": "스킬_3단계.zip",
                                      "encoding": "b64", "data": enc(b"PK fake zip")}).json()["ok"]
    c.post("/logs/session/end", json={"sessionId": sid, "user": user, "date": "2026-08-24",
                                      "endedAt": end, "reason": "normal"})

print("[stats]")
d = c.get("/admin/stats").json()
t = d["total"]
check("세션 수", t["sessions"] == 2, t)
check("사용자 수", t["userCount"] == 2)
check("스킬 수", t["skills"] == 2)
check("체류 합(42+5분)", abs(t["dwellMinutes"] - 47.0) < 0.2, t["dwellMinutes"])
check("byDate 에 사용자 수", d["byDate"][0]["userCount"] == 2, d["byDate"])
check("byUsers 정렬·값", {r["user"]: r["dwellMinutes"] for r in d["byUsers"]} == {"kim_a": 42.0, "lee_b": 5.0})
check("사용자 필터", c.get("/admin/stats?user=kim_a").json()["total"]["sessions"] == 1)
check("기간 필터(밖)", c.get("/admin/stats?from=2026-08-25").json()["total"]["sessions"] == 0)
check("/v1 별칭", c.get("/v1/admin/stats").status_code == 200)
check("날짜 형식 검증", c.get("/admin/stats?from=abc").status_code == 400)

print("[errors]")
e = c.get("/admin/errors").json()
check("오류 이벤트만 추림(세션당 2건)", e["count"] == 4, e["count"])
check("step.ok 는 안 섞임", all("step.ok" not in x["event"] for x in e["errors"]))
check("요약이 붙음", any("시트" in (x.get("summary") or "") for x in e["errors"]))
check("limit", c.get("/admin/errors?limit=1").json()["count"] == 1)
check("사용자 필터", all(x["user"] == "kim_a" for x in c.get("/admin/errors?user=kim_a").json()["errors"]))

print("")
print("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL")
raise SystemExit(0 if fails == 0 else 1)

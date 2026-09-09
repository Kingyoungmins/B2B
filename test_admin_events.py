# -*- coding: utf-8 -*-
"""[대시보드 확장 2026-08-31] /admin/events 집계 + errors 전량 스캔 검증.

왜 생겼나: 단계별 실행 데이터(ms/stepIdx/language)가 트레이스에 이미 쌓여 있는데 읽어 주는
API 가 없었고, /admin/errors 는 파일 끝 256KB 만 봐서 큰 세션의 앞부분 오류가 통째로 빠졌다
(오류율 지표로 못 씀). 세션당 1회 전량 스캔 + .agg_cache 캐시로 해결한다.

실행: python test_admin_events.py
"""
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import base64
import json
import tempfile
from pathlib import Path

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
        print("  FAIL  " + name + (("  -> " + str(detail)[:200]) if detail is not None else ""))


app = FastAPI()
app.include_router(collector.router)
app.include_router(collector.admin_router)
app.include_router(collector.admin_router, prefix="/v1")
ROOT = tempfile.mkdtemp(prefix="events_test_")
# 주의: /logs/session/start 는 요청의 date 를 무시하고 **서버의 오늘 날짜**로 폴더를 만든다
# (기존 동작 — append 는 date 를 존중해서, 다른 날짜를 보내면 세션이 두 폴더로 갈라진다).
# 그래서 이 테스트는 모든 세션을 오늘 날짜로 심는다.
import datetime
TODAY = datetime.date.today().isoformat()
collector.configure(root=ROOT)
c = TestClient(app)
enc = lambda b: base64.b64encode(b).decode()


def seed(user, sid, date, lines):
    assert c.post("/logs/session/start", json={"sessionId": sid, "user": user, "date": date,
                                               "startedAt": date + "T09:00:00",
                                               "appVersion": "0.8.2.0", "host": "VM-77"}).json()["ok"]
    blob = "".join(json.dumps(x) + "\n" for x in lines).encode()
    assert c.post("/logs/append", json={"sessionId": sid, "user": user, "date": date,
                                        "name": "vba_pipeline_trace.jsonl", "offset": 0,
                                        "encoding": "b64", "data": enc(blob)}).json()["ok"]
    return blob


print("[준비] 단계 이벤트(언어/소요/실패 위치)가 든 세션 2개")
seed("kim_a", "20260831-090000-1-aaaa", TODAY, [
    {"ts": TODAY + "T09:00:01", "event": "fullrun.step.ok", "stepIdx": 0, "stepId": "s1",
     "language": "vba", "ms": 100.0},
    {"ts": TODAY + "T09:00:02", "event": "fullrun.step.ok", "stepIdx": 1, "stepId": "s2",
     "language": "python", "ms": 300.0},
    {"ts": TODAY + "T09:00:03", "event": "fullrun.step.error", "stepIdx": 2, "stepId": "s3",
     "language": "vba", "error": "아래 첨자 사용이 잘못되었습니다"},
    {"ts": TODAY + "T09:00:04", "event": "excel.save.snapshot", "totalMs": 250.0},
])
seed("lee_b", "20260831-100000-2-bbbb", TODAY, [
    {"ts": TODAY + "T10:00:01", "event": "pipeline.step.ok", "stepIdx": 0, "language": "python",
     "ms": 500.0},
    {"ts": TODAY + "T10:00:02", "event": "pipeline.step.error", "stepIdx": 0,
     "error": "시트 'VIEW' 를 찾을 수 없습니다"},
])

print("")
print("[1] /admin/events — 트레이스에 있던 것이 드디어 API 로 나온다")
d = c.get("/admin/events").json()
check("ok", d.get("ok") is True, d)
ev = {r["event"]: r["count"] for r in d["byEvent"]}
check("이벤트별 건수", ev.get("fullrun.step.ok") == 2 and ev.get("pipeline.step.error") == 1, ev)
lang = {r["language"]: r for r in d["steps"]["byLanguage"]}
check("언어별 실행 수(vba=2, python=2)", lang["vba"]["runs"] == 2 and lang["python"]["runs"] == 2, lang)
check("언어별 실패(vba=1, 미기록=1)", lang["vba"]["error"] == 1
      and lang["python"]["error"] == 0 and lang["(미기록)"]["error"] == 1, lang)
check("언어별 평균 소요(python=400ms)", abs(lang["python"]["avgMs"] - 400.0) < 0.1, lang)
idx = {r["stepIdx"]: r for r in d["steps"]["byStepIdx"]}
check("단계 위치별 실패(0단계 1건, 2단계 1건)",
      idx[0]["error"] == 1 and idx[2]["error"] == 1 and idx[1]["error"] == 0, idx)
dur = {r["event"]: r for r in d["durations"]}
check("totalMs 로도 소요를 잡는다(snapshot)", dur["excel.save.snapshot"]["avgMs"] == 250.0, dur)
check("일별 오류 수", d["errorsByDate"] == [{"date": TODAY, "count": 2}], d["errorsByDate"])
check("스캔 현황", d["scanned"]["sessions"] == 2 and d["scanned"]["files"] == 2, d["scanned"])

print("")
print("[2] 캐시 — 두 번째 호출은 다시 읽지 않는다 / 로그가 늘면 다시 읽는다")
d2 = c.get("/admin/events").json()
check("두 번째 호출은 전부 캐시", d2["scanned"]["cached"] == 2, d2["scanned"])
check("결과는 동일", d2["byEvent"] == d["byEvent"])
# 같은 세션에 로그 추가 → 서명이 바뀌어 그 세션만 재스캔
extra = json.dumps({"ts": TODAY + "T09:10:00", "event": "fullrun.step.ok", "stepIdx": 3,
                    "language": "vba", "ms": 50.0}).encode() + b"\n"
prev = c.get("/admin/sessions?user=kim_a").json()["sessions"][0]
off = [v for k, v in json.loads(
    (Path(ROOT) / TODAY / "kim_a" / prev["sessionId"] / "session.json").read_text("utf-8")
)["files"].items() if k.endswith("vba_pipeline_trace.jsonl")][0]["bytes"]
assert c.post("/logs/append", json={"sessionId": prev["sessionId"], "user": "kim_a",
                                    "date": TODAY, "name": "vba_pipeline_trace.jsonl",
                                    "offset": off, "encoding": "b64", "data": enc(extra)}).json()["ok"]
d3 = c.get("/admin/events").json()
check("바뀐 세션만 재스캔(캐시 1)", d3["scanned"]["cached"] == 1, d3["scanned"])
check("새 이벤트가 반영", {r["event"]: r["count"] for r in d3["byEvent"]}["fullrun.step.ok"] == 3)

print("")
print("[3] /admin/errors — 이제 전량 스캔이라 앞부분 오류도 잡힌다")
# 256KB 꼬리 스캔이면 놓쳤을 상황: 파일 '앞' 에 오류, 뒤에 300KB 잡음
big_lines = [{"ts": TODAY + "T08:00:00", "event": "python_com.run.fail", "error": "앞부분 오류"}]
noise = {"ts": TODAY + "T08:00:01", "event": "runtime.sample", "pad": "x" * 400}
big_lines += [noise] * 800                                   # ≈ 300KB+
seed("park_c", "20260830-080000-3-cccc", TODAY, big_lines)
e = c.get("/admin/errors?user=park_c").json()
check("전량 스캔 표시", e.get("fullScan") is True, e)
check("파일 앞부분 오류를 잡는다(예전 256KB 꼬리 스캔이면 0건)",
      e["count"] == 1 and e["errors"][0]["summary"] == "앞부분 오류", e)

print("")
print("[4] 기존 응답 모양 유지(다른 세션이 만든 대시보드가 그대로 돌게)")
e2 = c.get("/admin/errors").json()
row = e2["errors"][0]
check("행 필드 유지", all(k in row for k in ("date", "user", "sessionId", "file", "ts",
                                             "event", "summary", "stepIdx", "stepId")), row)
check("최신순 정렬", e2["errors"][0]["ts"] >= e2["errors"][-1]["ts"])
check("limit 은 정렬 후 자름(최신 것이 남는다)",
      c.get("/admin/errors?limit=1").json()["errors"][0]["ts"] == e2["errors"][0]["ts"])
check("stats 는 영향 없음", c.get("/admin/stats").json()["total"]["sessions"] == 3)
check("/v1 별칭", c.get("/v1/admin/events").status_code == 200)
check("날짜 형식 검증", c.get("/admin/events?from=abc").status_code == 400)
cache_dir = Path(ROOT) / ".agg_cache"
check("캐시는 루트의 .agg_cache 에(세션 zip 에 안 섞임)", cache_dir.is_dir(), str(cache_dir))

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
import sys
sys.exit(1 if fails else 0)

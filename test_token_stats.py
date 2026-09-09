# -*- coding: utf-8 -*-
"""[0.8.3 토큰 계측] 수집 서버 — llm.usage 트레이스 집계(/admin/events tokens).

앱 프록시가 남긴 llm.usage 줄(vba_pipeline_trace.jsonl, log_sync 로 동기화)을
세션 스캔에서 집계해 총량/모델별/사용자별로 돌려준다.

실행: python test_token_stats.py
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


root = Path(tempfile.mkdtemp(prefix="tok_stats_"))
collector.configure(str(root))
client = TestClient(M.app)


def usage_line(model, p, c):
    return json.dumps({"event": "llm.usage", "model": model,
                       "promptTokens": p, "completionTokens": c, "totalTokens": p + c}) + "\n"


def make_session(user, sid, lines):
    r = client.post("/v1/logs/session/start", json={"sessionId": sid, "user": user})
    sdir = Path(r.json()["path"])
    (sdir / "logs" / "vba_pipeline_trace.jsonl").write_text("".join(lines), "utf-8")
    return sdir


print("[1] 두 사용자·두 모델의 usage 를 집계한다")
make_session("CLOUDPC_s0min", "tok-1", [
    usage_line("Qwen3.6-27B-FP8", 1000, 200),
    usage_line("Qwen3.6-27B-FP8", 500, 100),
    usage_line("claude-opus-4-8", 300, 50),
    json.dumps({"event": "other.event"}) + "\n",          # 무관 이벤트 — 집계 제외
])
make_session("CLOUDPC_other", "tok-2", [usage_line("Qwen3.6-27B-FP8", 2000, 400)])

r = client.get("/v1/admin/events").json()
tk = r.get("tokens") or {}
check("총량(입력/출력/총/호출)", tk.get("prompt") == 3800 and tk.get("completion") == 750
      and tk.get("total") == 4550 and tk.get("calls") == 4, tk)

by_model = {m["model"]: m for m in tk.get("byModel") or []}
check("모델별 — Qwen", by_model.get("Qwen3.6-27B-FP8", {}).get("total") == 4200
      and by_model["Qwen3.6-27B-FP8"]["calls"] == 3, by_model)
check("모델별 — Claude", by_model.get("claude-opus-4-8", {}).get("total") == 350, by_model)

by_user = {u["user"]: u for u in tk.get("byUser") or []}
check("사용자별 — s0min", by_user.get("CLOUDPC_s0min", {}).get("total") == 2150
      and by_user["CLOUDPC_s0min"]["prompt"] == 1800, by_user)
check("사용자별 — other", by_user.get("CLOUDPC_other", {}).get("total") == 2400, by_user)
check("정렬 — 토큰 많은 사용자가 먼저", (tk.get("byUser") or [{}])[0].get("user") == "CLOUDPC_other")

by_date = tk.get("byDate") or []
check("일별 추이 — 오늘 날짜로 전량 합산(총/입력/출력/호출)",
      len(by_date) == 1 and by_date[0].get("total") == 4550 and by_date[0].get("prompt") == 3800
      and by_date[0].get("completion") == 750 and by_date[0].get("calls") == 4, by_date)

print("[1b] 세션 목록에도 세션당 토큰 합계가 실린다")
rs = client.get("/v1/admin/sessions").json()
by_sid = {x["sessionId"]: x for x in rs["sessions"]}
t1 = (by_sid.get("tok-1") or {}).get("tokens") or {}
check("tok-1 합계(총/입력/출력/호출)", t1.get("total") == 2150 and t1.get("prompt") == 1800
      and t1.get("completion") == 350 and t1.get("calls") == 3, t1)
t2 = (by_sid.get("tok-2") or {}).get("tokens") or {}
check("tok-2 합계", t2.get("total") == 2400, t2)

print("[2] 두 번째 호출은 캐시를 탄다(값 동일)")
r2 = client.get("/v1/admin/events").json()
check("캐시 히트", r2["scanned"]["cached"] >= 2, r2["scanned"])
check("값 동일", (r2.get("tokens") or {}).get("total") == 4550)

print("[3] usage 없는 세션만 있으면 0 (오탐 없음)")
root2 = Path(tempfile.mkdtemp(prefix="tok_zero_"))
collector.configure(str(root2))
make_session("u", "no-usage", [json.dumps({"event": "upload.done"}) + "\n"])
r3 = client.get("/v1/admin/events").json()
tk3 = r3.get("tokens") or {}
check("전부 0", tk3.get("total") == 0 and tk3.get("calls") == 0 and tk3.get("byUser") == [], tk3)

print("[4] 전체실행(agent.run) 집계 — 0.8.4+ 앱의 telemetry_preview 동기화분")
collector.configure(str(Path(tempfile.mkdtemp(prefix="fr_stats_"))))
def run_line(status, ms):
    return json.dumps({"event_type": "agent.run", "status": status, "latency_ms": ms,
                       "input": {"skill_name": "***", "step_count": 5}}) + "\n"
make_session("CLOUDPC_s0min", "fr-1", [run_line("success", 30000), run_line("success", 50000),
                                       run_line("failed", 10000)])
make_session("CLOUDPC_other", "fr-2", [run_line("success", 20000)])
r = client.get("/v1/admin/events").json()
fr = r.get("fullRuns") or {}
check("횟수/성공/실패", fr.get("count") == 4 and fr.get("ok") == 3 and fr.get("error") == 1, fr)
check("평균 소요(ms)", fr.get("avgMs") == 27500.0, fr.get("avgMs"))
fru = {x["user"]: x for x in fr.get("byUser") or []}
check("사용자별", fru.get("CLOUDPC_s0min", {}).get("count") == 3
      and fru["CLOUDPC_s0min"]["error"] == 1 and fru.get("CLOUDPC_other", {}).get("count") == 1, fru)
check("event 필드 없는 레코드가 이벤트 집계를 오염시키지 않는다",
      "agent.run" not in [e["event"] for e in r.get("byEvent") or []], r.get("byEvent"))

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)

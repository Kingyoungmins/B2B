# -*- coding: utf-8 -*-
"""[0.8.3] 세션의 조직 정보(extra.org) — 저장·목록 노출·조직 필터.

앱(log_sync)이 whoami /fqdn 파싱 결과를 session/start 의 extra.org 로 보낸다.
서버는 meta 에 그대로 저장하고, /admin/sessions 가 team/orgPath 를 노출하며
org= 파라미터로 부분일치 필터한다. 구버전 앱 세션(extra 없음)은 빈 값으로 나온다.

실행: python test_org_in_admin.py
"""
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


root = Path(tempfile.mkdtemp(prefix="org_admin_"))
collector.configure(str(root))
client = TestClient(M.app)

ORG = {"displayName": "서영민", "empId": "s0min", "team": "Foundation리서치팀",
       "orgPath": "LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀",
       "orgLevels": ["LG유플러스", "CTO", "AI R_D센터", "AI R_D Lab", "Foundation리서치팀"]}

print("[1] 0.8.3 앱 세션 — extra.org 저장 + 목록 노출")
r = client.post("/v1/logs/session/start", json={
    "sessionId": "s-org-1", "user": "CLOUDPC\\s0min", "appVersion": "0.8.3.0",
    "extra": {"org": ORG}})
check("세션 시작 ok", r.json().get("ok"), r.json())
rows = client.get("/v1/admin/sessions").json()["sessions"]
row = next((x for x in rows if x["sessionId"] == "s-org-1"), None)
check("목록에 팀이 나온다", row and row.get("team") == "Foundation리서치팀", row)
check("전체 조직 경로도 나온다", row and row.get("orgPath") == ORG["orgPath"], row)
check("표시 이름도 나온다", row and row.get("displayName") == "서영민", row)

print("[2] 구버전 앱 세션(extra 없음) — 빈 값으로 무해하게")
client.post("/v1/logs/session/start", json={"sessionId": "s-old-1", "user": "CLOUDPC\\old"})
rows = client.get("/v1/admin/sessions").json()["sessions"]
row = next((x for x in rows if x["sessionId"] == "s-old-1"), None)
check("팀/경로가 빈 문자열", row is not None and row.get("team") == "" and row.get("orgPath") == "", row)

print("[3] 조직 필터 — 팀명/상위 조직명 부분일치")
client.post("/v1/logs/session/start", json={
    "sessionId": "s-org-2", "user": "CLOUDPC\\other", "appVersion": "0.8.3.0",
    "extra": {"org": {"team": "빌링플랫폼팀", "orgPath": "LG유플러스 > CTO > 빌링플랫폼팀"}}})
got = client.get("/v1/admin/sessions", params={"org": "Foundation"}).json()["sessions"]
check("팀명 일부로 거른다", [x["sessionId"] for x in got] == ["s-org-1"],
      [x["sessionId"] for x in got])
got = client.get("/v1/admin/sessions", params={"org": "CTO"}).json()["sessions"]
check("상위 조직명으로도 걸린다(둘 다)", sorted(x["sessionId"] for x in got) == ["s-org-1", "s-org-2"],
      [x["sessionId"] for x in got])
got = client.get("/v1/admin/sessions", params={"org": "cto"}).json()["sessions"]
check("대소문자 무시", len(got) == 2, got)
got = client.get("/v1/admin/sessions", params={"org": "없는팀"}).json()["sessions"]
check("안 걸리면 빈 목록", got == [], got)
got = client.get("/v1/admin/sessions").json()["sessions"]
check("필터 없으면 전부(구버전 포함)", len(got) == 3, len(got))

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)

# -*- coding: utf-8 -*-
"""[0.8.3] whoami /fqdn 조직 계층 파싱 + 로그 세션에 실리는지.

실측 DN(2026-09-02, VM):
  CN=서영민(s0min),OU=[VDIGRP_00058572]4^Foundation리서치팀,OU=[VDIGRP_00058571]3^AI R_D Lab,
  OU=[VDIGRP_00058245]2^AI R_D센터,OU=[VDIGRP_00055758]1^CTO,OU=[VDIGRP_00010000]0^LG유플러스,
  OU=LGUPlus,OU=LGUPlus Users,DC=CLOUDPC,DC=LGUPLUS,DC=NET
"""
import io
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import log_sync as L

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:250]) if not cond else ""))
    if not cond:
        fails.append(name)


DN = ("CN=서영민(s0min),OU=[VDIGRP_00058572]4^Foundation리서치팀,OU=[VDIGRP_00058571]3^AI R_D Lab,"
      "OU=[VDIGRP_00058245]2^AI R_D센터,OU=[VDIGRP_00055758]1^CTO,OU=[VDIGRP_00010000]0^LG유플러스,"
      "OU=LGUPlus,OU=LGUPlus Users,DC=CLOUDPC,DC=LGUPLUS,DC=NET")

print("[1] 실측 DN 그대로 파싱")
o = L.parse_fqdn_org(DN)
check("이름", o.get("displayName") == "서영민", o)
check("마당 아이디", o.get("madangId") == "s0min", o)
check("팀(가장 깊은 레벨)", o.get("team") == "Foundation리서치팀", o)
check("조직 경로(상위→하위)",
      o.get("orgPath") == "LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀",
      o.get("orgPath"))
check("레벨 5개", o.get("orgLevels") == ["LG유플러스", "CTO", "AI R_D센터", "AI R_D Lab",
                                        "Foundation리서치팀"], o.get("orgLevels"))
check("레벨 표기 없는 OU(LGUPlus Users 등)는 계층에서 제외",
      "LGUPlus" not in (o.get("orgLevels") or []), o.get("orgLevels"))

print("[2] 어긋난 입력에 안 죽는다")
check("빈 문자열 → 빈 dict", L.parse_fqdn_org("") == {})
check("DN 아님 → 빈 dict", L.parse_fqdn_org("CLOUDPC\\s0min") == {})
o2 = L.parse_fqdn_org("CN=홍길동(h001),OU=Users,DC=X")
check("OU 계층 없으면 이름/마당아이디만", o2.get("displayName") == "홍길동" and o2.get("madangId") == "h001"
      and "orgPath" not in o2, o2)
o3 = L.parse_fqdn_org("CN=관리자계정,DC=X")           # 괄호 아이디 없는 CN
check("아이디 없는 CN 도 이름은 잡는다", o3.get("displayName") == "관리자계정" and "madangId" not in o3, o3)
check("순서가 섞여 와도 레벨 기준 정렬",
      L.parse_fqdn_org("CN=a(b),OU=[v]0^회사,OU=[v]2^팀,OU=[v]1^본부,DC=x").get("orgPath")
      == "회사 > 본부 > 팀")

print("[3] 세션 시작 페이로드에 extra.org 로 실린다")
sent = {}
orig_post = L._post
L._post = lambda path, payload, timeout=15.0: (sent.update({"path": path, "payload": payload}),
                                               {"ok": True, "date": "2026-09-02"})[1]
orig_org = L.org_info
L.org_info = lambda: dict(o)                    # whoami 대신 실측 DN 파싱 결과
try:
    L._STATE["sessionAcked"] = False
    L._STATE["user"] = "CLOUDPC\\s0min"
    L._ensure_session()
finally:
    L._post = orig_post
    L.org_info = orig_org
check("session/start 로 갔다", sent.get("path") == "session/start", sent.get("path"))
check("extra.org.team", ((sent.get("payload") or {}).get("extra") or {}).get("org", {}).get("team")
      == "Foundation리서치팀", sent.get("payload"))
check("extra.org.orgPath 포함", "orgPath" in ((sent.get("payload") or {}).get("extra") or {}).get("org", {}))

print("[4] 캐시 — whoami 는 실행당 한 번만")
L._ORG_CACHE["done"] = False
calls = {"n": 0}
import subprocess as _sp
orig_run = _sp.run
def _spy(*a, **k):
    if a and isinstance(a[0], list) and "/fqdn" in a[0]:
        calls["n"] += 1
        class R: stdout = DN.encode("utf-8")
        return R()
    return orig_run(*a, **k)
_sp.run = _spy
try:
    r1 = L.org_info(); r2 = L.org_info()
finally:
    _sp.run = orig_run
    L._ORG_CACHE["done"] = False
check("whoami 1회 호출", calls["n"] == 1, calls)
check("두 번째는 캐시(같은 값)", r1 == r2 and r1.get("team") == "Foundation리서치팀", r1)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

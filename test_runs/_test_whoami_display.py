# -*- coding: utf-8 -*-
"""[0.8.3] 좌측 상단 계정 표시 — VM 에선 "사용자 : 실명", 개발망은 종전 그대로.

/api/whoami 가 log_sync.org_info()(whoami /fqdn 캐시)를 병합한다:
  · VM(도메인): displayName/madangId/team/orgPath 채워짐 → 화면이 "사용자 : 서영민"
  · 개발망(비도메인): org_info 가 빈 dict → 필드 빈 문자열 → 화면은 종전 표기(충돌 없음)
"""
import io
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import log_sync as L
import b2b_scheduler as B

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:250]) if not cond else ""))
    if not cond:
        fails.append(name)


ORG = {"displayName": "서영민", "madangId": "s0min", "team": "Foundation리서치팀",
       "orgPath": "LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀"}

print("[1] VM(도메인) — whoami 응답에 실명/마당아이디/조직이 실린다")
L._ORG_CACHE["value"] = dict(ORG); L._ORG_CACHE["done"] = True
try:
    info = B.current_windows_user()
finally:
    L._ORG_CACHE["done"] = False; L._ORG_CACHE["value"] = {}
check("기존 필드 그대로(whoami)", bool(info.get("whoami")), info.get("whoami"))
check("실명", info.get("displayName") == "서영민", info)
check("마당 아이디", info.get("madangId") == "s0min", info)
check("소속 경로", info.get("orgPath") == ORG["orgPath"], info.get("orgPath"))

print("[2] 개발망(비도메인) — 빈 값으로 종전 표기 유지")
L._ORG_CACHE["value"] = {}; L._ORG_CACHE["done"] = True     # fqdn 실패 상황 재현
try:
    info2 = B.current_windows_user()
finally:
    L._ORG_CACHE["done"] = False
check("whoami 는 여전히 나온다", bool(info2.get("whoami")), info2.get("whoami"))
check("실명 필드는 빈 문자열", info2.get("displayName") == "", info2.get("displayName"))
check("응답 형태는 항상 동일(필드 존재)", "madangId" in info2 and "team" in info2)

print("[3] 화면(whoami.js) — 표시 규칙")
js = (ROOT / "scripts" / "whoami.js").read_text("utf-8")
check("실명 있으면 '사용자 : 이름'",
      'info.displayName ? ("사용자 : " + info.displayName) : info.whoami' in js)
check("툴팁에 마당 아이디", '"마당 아이디: " + info.madangId' in js)
check("툴팁에 소속(조직 경로)", '"소속: " + info.orgPath' in js)
check("툴팁에 원래 로그인 계정도 유지", '"로그인 계정: " + info.whoami' in js)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

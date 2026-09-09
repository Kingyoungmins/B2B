# -*- coding: utf-8 -*-
"""[0.8.3] version.txt 허용 목록 계약 테스트 (Excel/네트워크 불필요, 수 초).

version.txt 에 버전을 줄바꿈으로 여러 개 적으면 '전부 허용'이다:
    0.7.4
    0.8.0
    0.8.2
· /v1/version : allowed=[전부], version/normalized=그중 최신 (예전 클라 호환)
· /v1/version/check?v= : 목록 안이면 match=true, 밖이면 false
· 한 줄만 적으면 종전(단일 비교)과 완전히 같다
· --download-url 을 주면 응답 downloadUrl 로 실린다

실행: python test_version_allowlist.py
"""
import sys
import tempfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import main as M
from fastapi.testclient import TestClient

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails += 1


work = Path(tempfile.mkdtemp(prefix="ver_allow_"))
vf = work / "version.txt"
client = TestClient(M.app)
M.VERSION_FILE = vf

print("[1] 여러 줄 = 전부 허용, version 은 최신")
vf.write_text("# 허용 버전 목록\n0.7.4\n0.8.0\n0.8.1\n0.8.2\n", "utf-8")
r = client.get("/v1/version").json()
check("ok", r["ok"], r)
check("allowed 4개(정규화)", r["allowed"] == ["0.7.4.0", "0.8.0.0", "0.8.1.0", "0.8.2.0"], r["allowed"])
check("version = 최신(0.8.2.0)", r["normalized"] == "0.8.2.0", r)

print("[2] check — 목록 안이면 통과, 밖이면 업데이트 안내")
for v, want in [("0.7.4.0", True), ("0.8.0", True), ("v0.8.2", True),
                ("0.7.3.0", False), ("0.8.3.0", False)]:
    r = client.get("/v1/version/check", params={"v": v}).json()
    check("%s → match=%s" % (v, want), r["match"] is want, r)

print("[3] 순서와 무관하게 최신을 고른다(내림차순으로 적어도)")
vf.write_text("0.8.2\n0.7.4\n", "utf-8")
r = client.get("/v1/version").json()
check("최신 = 0.8.2.0", r["normalized"] == "0.8.2.0", r)

print("[4] 한 줄이면 종전과 동일(단일 비교)")
vf.write_text("0.7.2.0\n", "utf-8")
r = client.get("/v1/version").json()
check("allowed=[그 버전]", r["allowed"] == ["0.7.2.0"], r)
check("version 그대로", r["normalized"] == "0.7.2.0", r)
r = client.get("/v1/version/check", params={"v": "0.7.2"}).json()
check("일치 → 통과", r["match"] is True, r)
r = client.get("/v1/version/check", params={"v": "0.7.1"}).json()
check("불일치 → 안내", r["match"] is False, r)

print("[5] 이상 입력 — 주석/빈 줄 무시, 형식 아님/빈 파일은 오류")
vf.write_text("# 메모만\n\n0.8.0\n# 또 메모\n", "utf-8")
r = client.get("/v1/version").json()
check("주석·빈 줄 건너뛰고 읽는다", r["ok"] and r["allowed"] == ["0.8.0.0"], r)
vf.write_text("최신버전입니다\n", "utf-8")
r = client.get("/v1/version").json()
check("형식 아님 → 오류로 알림", r["ok"] is False and "형식" in (r.get("error") or ""), r)
vf.write_text("# 주석뿐\n", "utf-8")
r = client.get("/v1/version").json()
check("빈 파일 → 오류로 알림", r["ok"] is False and "비어" in (r.get("error") or ""), r)

print("[6] 다운로드 주소 — 설정하면 응답에 실린다")
vf.write_text("0.8.2\n", "utf-8")
M.DOWNLOAD_URL = "https://seulgi.lguplus.co.kr/desk/smart-billing"
r = client.get("/v1/version").json()
check("downloadUrl 실림", r.get("downloadUrl") == "https://seulgi.lguplus.co.kr/desk/smart-billing", r)
M.DOWNLOAD_URL = ""
r = client.get("/v1/version").json()
check("없으면 null(앱이 기본값 사용)", r.get("downloadUrl") in (None, ""), r)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)

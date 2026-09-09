# -*- coding: utf-8 -*-
"""버전 서버 계약 테스트 (Excel/네트워크 불필요, 수 초).

실행: python test_version_service.py
"""
import io
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


work = Path(tempfile.mkdtemp(prefix="ver_test_"))
vf = work / "version.txt"
client = TestClient(M.app)


def set_file(text):
    io.open(vf, "w", encoding="utf-8").write(text)
    M.VERSION_FILE = vf


print("[1] 버전 표기 맞추기 — '0.7.2' 와 '0.7.2.0' 은 같은 버전이다")
for src, want in [("0.7.2", "0.7.2.0"), ("0.7.2.0", "0.7.2.0"), ("v0.7.2", "0.7.2.0"),
                  (" 1.2.3.4 ", "1.2.3.4"), ("1", "1.0.0.0"), ("", ""), ("abc", ""), ("1.2.x", "")]:
    got = M.normalize_version(src)
    check(f"normalize({src!r}) = {want!r}", got == want, got)

print("[2] 최신 버전 조회")
set_file("0.7.2.0\n")
r = client.get("/version").json()
check("ok", r["ok"] is True, r.get("error"))
check("버전 값", r["normalized"] == "0.7.2.0", r)
check("읽은 파일 경로 표시", r["source"] == str(vf))
check("수정 시각 포함", bool(r["updatedAt"]))

print("[3] 주석·빈 줄은 무시하고 첫 버전 줄을 쓴다")
set_file("# 배포 메모\n\n   \n0.8.1.0\n0.0.0.1\n")
check("주석 건너뜀", client.get("/version").json()["normalized"] == "0.8.1.0")

print("[4] 비교(/version/check)")
set_file("0.7.2.0\n")
check("같으면 match=True", client.get("/version/check?v=0.7.2.0").json()["match"] is True)
check("짧게 적어도 같게 봄", client.get("/version/check?v=0.7.2").json()["match"] is True)
check("다르면 match=False", client.get("/version/check?v=0.7.1.0").json()["match"] is False)
r = client.get("/version/check").json()
check("클라 버전 안 주면 match=None", r["match"] is None, r)
check("클라 버전 되돌려줌", client.get("/version/check?v=0.7.1").json()["client"] == "0.7.1.0")

print("[5] 잘못된 상태는 오류로 알린다(서버가 죽지 않는다)")
set_file("")
r = client.get("/version").json()
check("빈 파일 → ok=False", r["ok"] is False and "비어" in r["error"], r)
set_file("최신버전입니다\n")
r = client.get("/version").json()
check("버전 형식이 아니면 ok=False", r["ok"] is False and "형식" in r["error"], r)
M.VERSION_FILE = work / "no_such.txt"
r = client.get("/version").json()
check("파일 없으면 ok=False", r["ok"] is False and "찾을 수 없" in r["error"], r)
M.VERSION_FILE = None
r = client.get("/version").json()
check("경로 미지정이면 안내", r["ok"] is False and "--version-file" in r["error"], r)

print("[6] health")
check("health ok", client.get("/health").json()["ok"] is True)

print("[7] 전사 표준 — GET /v1/models 는 200 OK")
set_file("0.7.2.0\n")
r = client.get("/v1/models")
check("HTTP 200", r.status_code == 200, r.status_code)
check("OpenAI 호환 형태", r.json().get("object") == "list", r.json())
M.VERSION_FILE = None                       # version.txt 를 못 읽는 상태여도
r = client.get("/v1/models")
check("파일이 없어도 200 유지(서비스 죽음으로 오인 방지)", r.status_code == 200, r.status_code)

print("[8] /v1 별칭 — AX-Cell 이 기존 /v1 프록시로 부를 경로")
set_file("0.7.2.0\n")
check("/v1/version", client.get("/v1/version").json()["normalized"] == "0.7.2.0")
check("/v1/version/check", client.get("/v1/version/check?v=0.7.2").json()["match"] is True)
check("/v1/health", client.get("/v1/health").json()["ok"] is True)
check("/version 도 그대로 동작", client.get("/version").json()["normalized"] == "0.7.2.0")

print("[9] 요청으로 파일 경로를 받지 않는다(임의 파일 읽기 차단)")
set_file("0.7.2.0\n")
r = client.get("/version?path=C:\\Windows\\win.ini")
check("path 파라미터를 무시", r.json()["source"] == str(vf), r.json())

import shutil
shutil.rmtree(work, ignore_errors=True)
print("\n" + ("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL"))
sys.exit(1 if fails else 0)

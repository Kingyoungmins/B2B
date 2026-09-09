# -*- coding: utf-8 -*-
"""로그/스킬 수집기 계약 테스트 (네트워크·Excel 불필요, 수 초).

실행: python test_log_collector.py
"""
import base64
import gzip
import io
import json
import shutil
import sys
import tempfile
import zipfile
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


work = Path(tempfile.mkdtemp(prefix="collector_test_"))
root = work / "logs"
collector.configure(root)
client = TestClient(M.app)

SESSION = "20260824-091530-13244-a1b2"
USER = "kgm\\hong"            # whoami 결과 모양 (도메인\\사용자)
USER_DIR = "kgm_hong"


def enc(blob):
    return base64.b64encode(gzip.compress(blob)).decode("ascii")


def start(session=SESSION, user=USER, **kw):
    body = {"sessionId": session, "user": user, "host": "PC-01", "appVersion": "0.7.4.0",
            "startedAt": "2026-08-24T09:15:30", "pid": 13244, "osInfo": "Windows 11"}
    body.update(kw)
    return client.post("/v1/logs/session/start", json=body).json()


def append(name, text, offset=0, session=SESSION, user=USER, date=""):
    return client.post("/v1/logs/append", json={
        "sessionId": session, "user": user, "date": date, "name": name,
        "offset": offset, "encoding": "gzip+base64", "data": enc(text.encode("utf-8"))}).json()


print("[1] 세션 시작 — 날짜/사용자/세션 폴더가 생기고 logs·skills 가 짝으로 있다")
r = start()
check("ok", r.get("ok") is True, r)
sdir = Path(r["path"])
check("<루트>/날짜/사용자/세션 구조", sdir.parent.name == USER_DIR and sdir.name == SESSION, r)
check("날짜 폴더가 오늘", sdir.parent.parent.name == r["date"], r)
check("logs 폴더 생성", (sdir / "logs").is_dir())
check("skills 폴더 생성", (sdir / "skills").is_dir())
check("session.json 기록", json.loads((sdir / "session.json").read_text("utf-8"))["appVersion"] == "0.7.4.0")
check("두 번 불러도 같은 폴더", start()["created"] is False)

print("[2] 로그 이어붙이기 — 새로 늘어난 부분만 보낸다")
a = append("vba_pipeline_trace.jsonl", '{"e":1}\n')
check("첫 조각 저장", a["ok"] and a["accepted"] == 8, a)
a = append("vba_pipeline_trace.jsonl", '{"e":2}\n', offset=8)
got = (sdir / "logs" / "vba_pipeline_trace.jsonl").read_text("utf-8")
check("이어붙는다", got == '{"e":1}\n{"e":2}\n', got)
check("서버가 아는 크기", a["size"] == 16, a)

print("[3] 같은 조각을 다시 보내도 두 번 들어가지 않는다(재전송 안전)")
a = append("vba_pipeline_trace.jsonl", '{"e":2}\n', offset=8)
got = (sdir / "logs" / "vba_pipeline_trace.jsonl").read_text("utf-8")
check("중복 무시", got == '{"e":1}\n{"e":2}\n', got)
check("받은 바이트 0", a["accepted"] == 0, a)
a = append("vba_pipeline_trace.jsonl", '{"e":2}\n{"e":3}\n', offset=8)
got = (sdir / "logs" / "vba_pipeline_trace.jsonl").read_text("utf-8")
check("겹치는 앞부분만 잘라내고 뒤를 붙인다", got == '{"e":1}\n{"e":2}\n{"e":3}\n', got)

print("[4] 중간이 비면(전송 실패 구간) 기록으로 남긴다")
a = append("gap.log", "AAAA", offset=10)
check("빈 구간 보고", a["gap"] == 10, a)
meta = json.loads((sdir / "session.json").read_text("utf-8"))
check("session.json 에 남는다", meta["files"]["logs/gap.log"]["gaps"][0]["missingBytes"] == 10, meta["files"])

print("[5] 스킬 zip 은 같은 세션 폴더의 skills/ 로 (요청 4번: 로그와 페어)")
zbuf = io.BytesIO()
with zipfile.ZipFile(zbuf, "w") as zf:
    zf.writestr("skill.json", '{"steps":[]}')
r = client.post("/v1/logs/file", json={
    "sessionId": SESSION, "user": USER, "kind": "skill",
    "name": "A고객 전화서비스_1단계_2026-08-24-09-21-46.zip",
    "encoding": "gzip+base64", "data": enc(zbuf.getvalue()),
    "createdAt": "2026-08-24T09:21:46"}).json()
check("저장 성공", r.get("ok") and not r.get("duplicate"), r)
saved = sdir / "skills" / "A고객 전화서비스_1단계_2026-08-24-09-21-46.zip"
check("한글 이름 그대로", saved.exists(), list((sdir / "skills").glob("*")))
check("zip 이 깨지지 않았다", zipfile.ZipFile(saved).read("skill.json") == b'{"steps":[]}')
r2 = client.post("/v1/logs/file", json={
    "sessionId": SESSION, "user": USER, "kind": "skill",
    "name": "A고객 전화서비스_1단계_2026-08-24-09-21-46.zip",
    "encoding": "gzip+base64", "data": enc(zbuf.getvalue())}).json()
check("같은 파일 재전송은 건너뛴다", r2.get("duplicate") is True, r2)

print("[6] 세션 종료 표시")
r = client.post("/v1/logs/session/end", json={
    "sessionId": SESSION, "user": USER, "endedAt": "2026-08-24T10:02:00", "reason": "정상 종료"}).json()
check("ok", r.get("ok") is True, r)
meta = json.loads((sdir / "session.json").read_text("utf-8"))
check("closed=True", meta["closed"] is True and meta["endReason"] == "정상 종료", meta)

print("[7] 경로 탈출 차단 — 사용자/세션/파일 이름을 그대로 쓰지 않는다")
r = client.post("/v1/logs/append", json={
    "sessionId": "../../evil", "user": "..\\..\\admin", "name": "../../../etc/passwd",
    "encoding": "text", "data": "x"}).json()
saved_path = Path(r["path"])
check("루트 밖으로 못 나간다", str(saved_path).startswith(str(root)), r)
check("파일명도 세탁", saved_path.name == "passwd", saved_path.name)
check("탈출 경로가 실제로 안 생겼다", not (work / "etc").exists() and not (root.parent / "evil").exists())
for bad, want in [("..", "unknown"), (".", "unknown"), ("", "unknown"), ("a/b", "a_b"), ("C:\\x", "C_x")]:
    check(f"safe_part({bad!r})", collector.safe_part(bad, "unknown") == want, collector.safe_part(bad, "unknown"))

print("[8] 시작 요청이 없어도 받은 자료는 버리지 않는다(서버 재시작·유실 대비)")
r = append("late.log", "hello", session="20260824-120000-999-zz99", user="kgm\\lost")
late = Path(r["path"]).parent.parent
check("폴더를 만들어 저장", (late / "logs" / "late.log").read_text("utf-8") == "hello", r)
check("복구 표시", json.loads((late / "session.json").read_text("utf-8"))["recovered"] is True)

print("[9] 세션 용량 상한 — 넘으면 그만 받는다(디스크 보호)")
collector.MAX_SESSION_MB = 1
big = append("big.log", "x" * 2000, session="cap-session", user="kgm\\cap")
check("상한 안이면 받는다", big["ok"] and big["accepted"] == 2000, big)
huge = client.post("/v1/logs/append", json={
    "sessionId": "cap-session", "user": "kgm\\cap", "name": "big.log",
    "offset": 2000, "encoding": "gzip+base64",
    "data": enc(b"y" * (1024 * 1024 + 10))}).json()
check("상한 넘으면 capped 로 알려준다", huge.get("capped") is True, huge)
collector.MAX_SESSION_MB = 300

print("[10] 관리자 조회 — 목록과 세션 zip")
r = client.get("/admin/sessions").json()
check("목록 ok", r["ok"] and r["count"] >= 3, r.get("count"))
mine = [s for s in r["sessions"] if s["sessionId"] == SESSION]
check("내 세션이 보인다", len(mine) == 1, [s["sessionId"] for s in r["sessions"]])
s0 = mine[0]
check("로그/스킬 개수 요약", len(s0["logFiles"]) >= 2 and len(s0["skillFiles"]) == 1, s0)
check("종료 여부 표시", s0["closed"] is True, s0)
z = client.get(s0["zipUrl"])
check("zip 200", z.status_code == 200, z.status_code)
check("zip 첨부 헤더", "attachment" in z.headers.get("content-disposition", ""), z.headers)
names = zipfile.ZipFile(io.BytesIO(z.content)).namelist()
check("zip 안에 세션 폴더 통째로", any(n.endswith("session.json") for n in names)
      and any("logs/" in n for n in names) and any("skills/" in n for n in names), names)

print("[11] 하루치 zip / 날짜 목록")
today = s0["date"]
z = client.get(f"/admin/day.zip?date={today}")
check("day.zip 200", z.status_code == 200, z.status_code)
check("여러 사용자가 함께 들어간다",
      len({n.split("/")[1] for n in zipfile.ZipFile(io.BytesIO(z.content)).namelist() if "/" in n}) >= 2)
d = client.get("/admin/dates").json()
check("날짜 목록", d["ok"] and d["dates"][0]["date"] == today, d)
check("잘못된 날짜는 400", client.get("/admin/day.zip?date=2026-8-4").status_code == 400)
check("없는 세션은 404", client.get(f"/admin/session.zip?date={today}&user=x&session=y").status_code == 404)

print("[12] 관리자 화면(zip 클릭용)")
h = client.get("/admin")
check("HTML 200", h.status_code == 200 and "AX-Cell 수집 로그" in h.text, h.status_code)
check("zip 링크 포함", "session.zip" in h.text)

print("[13] 인증 키를 정하면 없이는 못 보낸다")
collector.INGEST_KEY = "s3cret"
r = client.post("/v1/logs/append", json={"sessionId": SESSION, "user": USER, "name": "a.log",
                                         "encoding": "text", "data": "x"})
check("키 없으면 401", r.status_code == 401, r.status_code)
r = client.post("/v1/logs/append", json={"sessionId": SESSION, "user": USER, "name": "a.log",
                                         "encoding": "text", "data": "x"},
                headers={"X-B2B-Log-Key": "s3cret"})
check("키 있으면 통과", r.status_code == 200, r.status_code)
collector.INGEST_KEY = ""
collector.ADMIN_KEY = "adm"
check("관리자 키 없으면 401", client.get("/admin/sessions").status_code == 401)
check("관리자 키 맞으면 200", client.get("/admin/sessions?key=adm").status_code == 200)
check("헤더로도 통과", client.get("/admin/sessions", headers={"X-Admin-Key": "adm"}).status_code == 200)
collector.ADMIN_KEY = ""

print("[14] /v1 별칭과 상태 확인")
check("/logs/health", client.get("/logs/health").json()["ok"] is True)
check("/v1/logs/health", client.get("/v1/logs/health").json()["root"] == str(root))
check("버전 확인은 그대로 동작", client.get("/v1/models").status_code == 200)

print("[15] 수집 폴더가 없으면(끈 상태) 503 으로 분명히 알린다")
collector.LOG_ROOT = None
r = client.post("/v1/logs/append", json={"sessionId": "s", "user": "u", "name": "a.log",
                                         "encoding": "text", "data": "x"})
check("503", r.status_code == 503, r.status_code)
check("버전 확인은 영향 없음", client.get("/v1/models").status_code == 200)
collector.configure(root)

shutil.rmtree(work, ignore_errors=True)
print("\n" + ("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL"))
sys.exit(1 if fails else 0)

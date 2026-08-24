# -*- coding: utf-8 -*-
"""로그/스킬 자동 전송(log_sync) 계약 테스트 — Excel·외부망 불필요, 수 초.

실행: python test_runs/_test_log_sync.py

가짜 수집 서버를 이 프로세스 안에 띄우고 실제 HTTP 로 주고받는다(수집 서버 계약과 같은 모양).
서버 쪽 계약 테스트는 versionTest/test_log_collector.py 에 따로 있다.
로그 파일은 전부 바이트로 쓴다 — 텍스트 모드로 쓰면 윈도우에서 개행이 CRLF 로 바뀌어
'보낸 바이트 수' 비교가 무너진다(전송 로직 문제가 아니라 테스트가 만든 착시).
"""
import base64
import gzip
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails += 1


# ── 가짜 수집 서버 (versionTest/collector.py 와 같은 계약) ────────────────
STORE = {"logs": {}, "skills": {}, "calls": [], "sessions": [], "ends": [], "fail_next": 0}
_SLOCK = threading.Lock()


class FakeCollector(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("content-length") or 0))
        payload = json.loads(body.decode("utf-8"))
        with _SLOCK:
            STORE["calls"].append((self.path, payload.get("name", ""), self.headers.get("Api-Key", "")))
            if STORE["fail_next"] > 0:
                STORE["fail_next"] -= 1
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b"down")
                return
            out = {"ok": True}
            if self.path.endswith("/session/start"):
                STORE["sessions"].append(payload)
                out = {"ok": True, "created": True, "date": "2026-08-24", "path": "/srv/x"}
            elif self.path.endswith("/session/end"):
                STORE["ends"].append(payload)
            elif self.path.endswith("/append"):
                blob = gzip.decompress(base64.b64decode(payload["data"]))
                have = STORE["logs"].get(payload["name"], b"")
                offset = int(payload.get("offset") or 0)
                if offset < len(have):                       # 서버와 같은 중복 제거 규칙
                    blob = blob[len(have) - offset:]
                STORE["logs"][payload["name"]] = have + blob
                out = {"ok": True, "accepted": len(blob), "size": len(STORE["logs"][payload["name"]])}
            elif self.path.endswith("/file"):
                STORE["skills"][payload["name"]] = gzip.decompress(base64.b64decode(payload["data"]))
                out = {"ok": True, "duplicate": False}
        raw = json.dumps(out).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


server = ThreadingHTTPServer(("127.0.0.1", 0), FakeCollector)
threading.Thread(target=server.serve_forever, daemon=True).start()
PORT = server.server_address[1]

work = Path(tempfile.mkdtemp(prefix="log_sync_test_"))
log_dir = work / "B2B_logs"
skill_dir = work / "auto_backup"
log_dir.mkdir()
skill_dir.mkdir()

# 이전 실행의 잔재 — 이번 세션 것이 아니므로 올라가면 안 된다.
old_log = log_dir / "old_run.jsonl"
old_log.write_bytes(b'{"old":1}\n')
os.utime(old_log, (time.time() - 3600, time.time() - 3600))

os.environ["B2B_LOG_SYNC_URL"] = f"http://127.0.0.1:{PORT}"
os.environ["B2B_LOG_SYNC_KEY"] = "testkey"
os.environ["B2B_LOG_SYNC_INTERVAL"] = "600"      # 주기 스레드가 끼어들지 않게 (테스트는 tick 을 직접 부른다)
os.environ.pop("B2B_LOG_SYNC", None)

import log_sync

log_sync.SKILL_SETTLE_SECONDS = 0.5              # 테스트에서 '다 쓴 파일' 판정을 오래 기다리지 않게

print("[1] 사용자 구분 — whoami 결과를 쓴다")
user = log_sync.current_user()
check("사용자 이름을 얻는다", bool(user) and user != "unknown", user)
check("환경변수 사용자명과 일치", (os.environ.get("USERNAME", "").lower() in user.lower()) or os.name != "nt", user)

print("[2] 세션 시작 — 실행 1회 = 세션 1개")
log_sync.start(app_version="0.7.4.0", log_dirs=[log_dir], skill_dirs=[skill_dir], app_dir=str(work))
trace = log_dir / "vba_pipeline_trace.jsonl"
trace.write_bytes(b'{"e":1}\n{"e":2}\n')
moved = log_sync.tick()
check("보낸 바이트 있음", moved == 16, moved)
check("세션 시작을 알렸다", len(STORE["sessions"]) == 1, STORE["sessions"])
s0 = STORE["sessions"][0]
check("세션 아이디에 날짜·pid",
      s0["sessionId"].startswith(time.strftime("%Y%m%d")) and str(os.getpid()) in s0["sessionId"], s0["sessionId"])
check("사용자/버전/PC 를 함께 보낸다", s0["user"] == user and s0["appVersion"] == "0.7.4.0" and s0["host"], s0)
check("로그 내용 도착", STORE["logs"].get("vba_pipeline_trace.jsonl") == b'{"e":1}\n{"e":2}\n', STORE["logs"])
check("게이트웨이 키를 헤더에 실었다", all(c[2] == "testkey" for c in STORE["calls"]), STORE["calls"][:2])

print("[3] 예전 실행의 로그는 올리지 않는다(이번에 쓰인 것만)")
check("old_run.jsonl 미전송", "old_run.jsonl" not in STORE["logs"], list(STORE["logs"]))

print("[4] 다음 주기 — 늘어난 부분만 보낸다")
before = len([c for c in STORE["calls"] if c[0].endswith("/append")])
check("변화 없으면 안 보낸다", log_sync.tick() == 0 and
      len([c for c in STORE["calls"] if c[0].endswith("/append")]) == before)
with open(trace, "ab") as f:
    f.write(b'{"e":3}\n')
check("추가분만 전송", log_sync.tick() == 8)
check("서버 내용이 원본과 같다", STORE["logs"]["vba_pipeline_trace.jsonl"] == trace.read_bytes(), STORE["logs"])

print("[5] 스킬 zip 은 같은 세션으로 한 번만")
zpath = skill_dir / "A고객 전화서비스_1단계_2026-08-24-09-21-46.zip"
with zipfile.ZipFile(zpath, "w") as zf:
    zf.writestr("skill.json", '{"steps":[1]}')
os.utime(zpath, (time.time() - 1, time.time() - 1))       # 다 써서 안정된 상태로
log_sync.tick()
check("스킬 도착", zpath.name in STORE["skills"], list(STORE["skills"]))
if zpath.name in STORE["skills"]:
    check("zip 이 깨지지 않았다",
          zipfile.ZipFile(io.BytesIO(STORE["skills"][zpath.name])).read("skill.json") == b'{"steps":[1]}')
n_files = len([c for c in STORE["calls"] if c[0].endswith("/file")])
log_sync.tick()
check("다시 보내지 않는다", len([c for c in STORE["calls"] if c[0].endswith("/file")]) == n_files)

print("[6] 아직 쓰는 중인 zip 은 다음 주기로 미룬다(반쪽 파일 방지)")
fresh = skill_dir / "쓰는중_1단계_2026-08-24-09-30-00.zip"
fresh.write_bytes(b"PK\x03\x04not-finished")
log_sync.tick()
check("금방 만들어진 파일은 건너뛴다", fresh.name not in STORE["skills"], list(STORE["skills"]))
os.utime(fresh, (time.time() - 1, time.time() - 1))
log_sync.tick()
check("안정되면 보낸다", fresh.name in STORE["skills"], list(STORE["skills"]))

print("[7] 서버가 죽어 있어도 앱은 멀쩡하고, 살아나면 빠진 것 없이 이어진다")
with _SLOCK:
    STORE["fail_next"] = 5
with open(trace, "ab") as f:
    f.write(b'{"e":4}\n')
check("예외를 밖으로 내지 않는다", log_sync.tick() == 0)
check("실패를 상태로 알린다", log_sync.status()["failures"] > 0 and "503" in log_sync.status()["lastError"],
      log_sync.status()["lastError"])
with _SLOCK:
    STORE["fail_next"] = 0
log_sync.tick()
check("빠진 구간 없이 복구", STORE["logs"]["vba_pipeline_trace.jsonl"] == trace.read_bytes(),
      STORE["logs"]["vba_pipeline_trace.jsonl"])

print("[8] 실행 중에 로그가 비워지면 서버에는 다른 이름으로 이어 쓴다(내용 유실 방지)")
kept = STORE["logs"]["vba_pipeline_trace.jsonl"]
trace.write_bytes(b'{"new":1}\n')
log_sync.tick()
check("비우기 전 내용은 그대로 남는다", STORE["logs"]["vba_pipeline_trace.jsonl"] == kept)
check("새 내용은 .r1 로 들어간다", STORE["logs"].get("vba_pipeline_trace.r1.jsonl") == b'{"new":1}\n',
      list(STORE["logs"]))

print("[9] 종료 — 마지막으로 한 번 더 보내고 '끝'을 알린다")
with open(trace, "ab") as f:
    f.write(b'{"last":1}\n')
log_sync.stop("test", timeout=5)
check("마지막 조각까지 전송", STORE["logs"]["vba_pipeline_trace.r1.jsonl"] == trace.read_bytes(),
      STORE["logs"]["vba_pipeline_trace.r1.jsonl"][-40:])
check("세션 종료 통보", len(STORE["ends"]) == 1 and STORE["ends"][0]["reason"] == "test", STORE["ends"])
check("같은 세션으로 닫았다", STORE["ends"][0]["sessionId"] == s0["sessionId"])
check("두 번 불러도 조용히 넘어간다", log_sync.stop("test2")["stopped"] is True)

print("[10] 상태 조회(/api/log-sync/status 가 그대로 돌려주는 값)")
st = log_sync.status()
check("어디로 보내는지", st["upstreamUrl"] == f"http://127.0.0.1:{PORT}", st["upstreamUrl"])
check("보낸 양·세션 표시", st["sentBytes"] > 0 and st["sessionId"] == s0["sessionId"], st)

print("[11] 끄면 아무것도 안 보낸다")
os.environ["B2B_LOG_SYNC"] = "0"
n = len(STORE["calls"])
check("설정이 꺼짐으로 보인다", log_sync.config()["enabled"] is False)
check("tick 이 아무 일도 안 한다", log_sync.tick() == 0 and len(STORE["calls"]) == n)
os.environ.pop("B2B_LOG_SYNC")

print("[12] 주소 정리 — 뒤에 /v1 이나 /version 이 붙어 있어도 받아준다")
for raw, want in [("http://a/v1", "http://a"), ("http://a/version", "http://a"),
                  ("http://a/v1/version", "http://a"), ("http://a/", "http://a"), ("  http://a  ", "http://a")]:
    check("normalize(%r)" % raw, log_sync._normalize_base(raw) == want, log_sync._normalize_base(raw))

server.shutdown()
shutil.rmtree(work, ignore_errors=True)

# ── [코드리뷰 2026-08-24] 데이터 유실 3건 — 동작으로 잠근다 ──────────────────
def test_review_fixes():
    import log_sync as L
    print("[리뷰] 수집 서버 전환 / 종료 플러시 / 비정상 응답")
    # 판정 기준은 '실효 주소'(환경변수 > 화면설정 > 기본값)다. 이 테스트 파일은 위에서
    # B2B_LOG_SYNC_URL 을 고정해 두므로, 그 상태로는 화면 설정을 바꿔도 실효 주소가 안 바뀐다
    # — 그게 정상 동작이다(환경변수로 고정한 서버를 화면이 못 가로채야 한다). 먼저 그걸 확인하고,
    # 환경변수를 잠시 걷어낸 상태에서 '진짜 주소 변경'을 검증한다.
    _saved_env = os.environ.pop("B2B_LOG_SYNC_URL", None)
    try:
        L._CONFIG["upstreamUrl"] = ""
        L.update_config({"upstreamUrl": "http://a.example"})
        L._STATE["sessionAcked"] = True
        L._STATE["offsets"] = {"x.log": 800}
        L._STATE["sentBytes"] = 800
        L.update_config({"upstreamUrl": "http://b.example"})
    # 주소가 바뀌면 새 서버에선 처음부터다. 예전엔 offset=800 부터 붙어
    # session/start 없는 세션 + 앞 800바이트가 빠진 로그가 저장됐다.
        check("서버를 바꾸면 세션을 다시 연다", L._STATE["sessionAcked"] is False)
        check("서버를 바꾸면 오프셋을 버린다(앞부분 유실 방지)", L._STATE["offsets"] == {})
        check("서버를 바꾸면 누적 바이트도 초기화", L._STATE["sentBytes"] == 0)
        L._STATE["offsets"] = {"x.log": 800}
        L.update_config({"upstreamUrl": "http://b.example"})
        check("같은 주소면 이어서 보낸다(불필요한 재전송 없음)", L._STATE["offsets"] == {"x.log": 800})
    finally:
        if _saved_env is not None:
            os.environ["B2B_LOG_SYNC_URL"] = _saved_env
    # 환경변수가 주소를 고정하면 화면 설정을 바꿔도 실효 주소가 그대로 — 초기화하면 안 된다.
    L._STATE["offsets"] = {"x.log": 800}
    L.update_config({"upstreamUrl": "http://somewhere-else.example"})
    check("환경변수로 고정된 주소는 화면이 못 바꾼다(오프셋 보존)", L._STATE["offsets"] == {"x.log": 800})

    # 주기 스레드가 tick() 안에 있으면 예전엔 종료 플러시가 조용히 건너뛰어졌다.
    import threading as _th, time as _t
    L._CONFIG["upstreamUrl"] = "http://b.example"
    L._STATE["capped"] = False
    with L._LOCK:
        L._STATE["running"] = True
    t0 = _t.time()
    check("안 기다리면 즉시 반환(기존 동작 보존)",
          L.tick(timeout=1.0, wait_running=0.0) == 0 and _t.time() - t0 < 0.3)

    def _release():
        _t.sleep(0.4)
        with L._LOCK:
            L._STATE["running"] = False
    _th.Thread(target=_release, daemon=True).start()
    t0 = _t.time()
    try:
        L.tick(timeout=1.0, wait_running=2.0)
    except Exception:
        pass
    check("종료 경로는 스레드가 비울 때까지 기다린다", _t.time() - t0 >= 0.35)
    with L._LOCK:
        L._STATE["running"] = False

    # 서버가 dict 아닌 JSON 을 주면 result.get 에서 죽어 tick 전체가 매 주기 실패했다.
    check("스칼라 응답을 실패로 정규화", L._as_result(123).get("ok") is False)
    check("dict 응답은 그대로", L._as_result({"ok": True}).get("ok") is True)
    check("None 도 안전", L._as_result(None).get("ok") is False)


test_review_fixes()


print("\n" + ("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL"))
sys.exit(1 if fails else 0)

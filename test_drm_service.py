# -*- coding: utf-8 -*-
"""문서보안(DRM) 연동 계약 테스트 — 실제 Gateway 없이, 가짜 Gateway 를 이 프로세스에 띄워
urllib 호출 경로까지 통째로 검증한다. (실제 Gateway 호출은 test_drm_integration.py — 기본 SKIP)

실행: python test_drm_service.py
"""
import io
import json
import logging
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import drm
import main as M
from fastapi.testclient import TestClient

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails += 1


# ── 가짜 MIP Gateway ──────────────────────────────────────────────────────
GW = {"mode": "ok", "calls": [], "sleep": 0.0}
ENC_MAGIC = b"MIPENC1:"


def _parse_multipart(body, content_type):
    """테스트용 최소 multipart 해석 — file 파트의 (filename, bytes)만 꺼낸다."""
    m = re.search(r"boundary=([^;]+)", content_type or "")
    if not m:
        return "", b""
    boundary = ("--" + m.group(1).strip()).encode()
    for part in body.split(boundary):
        if b'name="file"' not in part:
            continue
        head, _, payload = part.partition(b"\r\n\r\n")
        fm = re.search(rb'filename="([^"]*)"', head)
        filename = fm.group(1).decode("utf-8", "replace") if fm else ""
        return filename, payload.rsplit(b"\r\n", 1)[0]
    return "", b""


class FakeGateway(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, status=200):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json;charset=UTF-8")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _stream(self, data, filename="out.bin"):
        self.send_response(200)
        self.send_header("content-type", "application/octet-stream")
        self.send_header("content-disposition", 'attachment; filename="%s"' % filename)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        qs = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
        body = self.rfile.read(int(self.headers.get("content-length") or 0))
        filename, file_bytes = _parse_multipart(body, self.headers.get("content-type"))
        GW["calls"].append({"qs": qs, "filename": filename, "size": len(file_bytes)})
        if GW["sleep"]:
            time.sleep(GW["sleep"])
        mode = GW["mode"]
        if mode == "auth_error":
            return self._json({"result": "-100", "result_msg": "허용되지 않은 IP에서 호출하였습니다."})
        if mode == "business_error":
            return self._json({"result": "-200", "result_msg": "등록되지 않은 사용자입니다."})
        if mode == "server_error":
            return self._json({"result": "-999", "result_msg": "시스템에 문제가 발생하였습니다."})
        if mode == "malformed":
            raw = b"<html>oops</html>"
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if mode == "empty_stream":
            return self._stream(b"")
        if mode == "http_500_json":
            return self._json({"result": "-999", "result_msg": "시스템 오류"}, status=500)

        method = qs.get("method", "")
        if method == "drmEncryptAPI":
            return self._stream(ENC_MAGIC + file_bytes, filename)
        if method == "drmDecryptAPI":
            if file_bytes.startswith(ENC_MAGIC):
                return self._stream(file_bytes[len(ENC_MAGIC):], filename)
            return self._json({"result": "-200", "result_msg": "복호화 대상 파일이 아닙니다."})
        if method == "drmSecretAPI":
            secret = b"SECRET" in file_bytes
            return self._json({"result": "S_DOC", "result_msg": "비밀문서 입니다."} if secret
                              else {"result": "N_DOC"})
        if method == "drmPolicyAPI":
            if qs.get("decodeType") == "encrypt":
                return self._stream(ENC_MAGIC + file_bytes, filename)
            if qs.get("decodeType") == "decrypt":
                if file_bytes.startswith(ENC_MAGIC):
                    return self._stream(file_bytes[len(ENC_MAGIC):], filename)
                return self._json({"result": "-200", "result_msg": "복호화 대상 파일이 아닙니다."})
            return self._json({"result": "-200", "result_msg": "decodeType 이 없습니다."})
        return self._json({"result": "-200", "result_msg": "알 수 없는 method"})


gw_server = ThreadingHTTPServer(("127.0.0.1", 0), FakeGateway)
threading.Thread(target=gw_server.serve_forever, daemon=True).start()
GW_URL = "http://127.0.0.1:%d/webapi/api/lguplusstreams/noSessiondo" % gw_server.server_address[1]

TEST_KEY = "TESTKEY-0000-1111"
drm.configure(base_url=GW_URL, api_key=TEST_KEY, account="default_account", timeout=60)
client = TestClient(M.app)

# 로그에 keyCode 가 새는지 감시한다.
_log_lines = []


class _Capture(logging.Handler):
    def emit(self, record):
        _log_lines.append(record.getMessage())


logging.getLogger("axcell.drm").addHandler(_Capture())
logging.getLogger("axcell.drm").setLevel(logging.INFO)

PLAIN = b"PK\x03\x04 fake xlsx bytes for test"


def call(path, filename="sample.xlsx", data=PLAIN, form=None):
    return client.post(path, files={"file": (filename, io.BytesIO(data), "application/octet-stream")},
                       data=form or {})


print("[1] 암호화(drmEncryptAPI) — 파일이 그대로 갔다가 암호화되어 돌아온다")
GW["mode"] = "ok"
GW["calls"] = []
r = call("/api/drm/encrypt", form={"requestorAccount": "hong"})
check("HTTP 200", r.status_code == 200, (r.status_code, r.text[:120]))
check("octet-stream", "octet-stream" in r.headers.get("content-type", ""), r.headers)
check("암호화본 수신", r.content == ENC_MAGIC + PLAIN)
check("첨부 헤더에 파일명", "sample.xlsx" in r.headers.get("content-disposition", ""), r.headers)
q = GW["calls"][0]["qs"]
check("공통 파라미터(method/keyCode/계정/PG01)",
      q.get("method") == "drmEncryptAPI" and q.get("keyCode") == TEST_KEY
      and q.get("requestorAccount") == "hong" and q.get("policyGCode") == "PG01", q)
check("파일이 multipart 로 전달", GW["calls"][0]["size"] == len(PLAIN), GW["calls"][0])

print("[2] labelid — 지정하면 그대로 전달, 안 하면 안 붙는다")
check("labelid 미지정 시 없음", "labelid" not in GW["calls"][0]["qs"])
call("/api/drm/encrypt", form={"requestorAccount": "hong", "labelid": "L-7"})
check("labelid 전달", GW["calls"][-1]["qs"].get("labelid") == "L-7", GW["calls"][-1]["qs"])

print("[3] 복호화(drmDecryptAPI) — 왕복하면 원본이 된다")
r = call("/api/drm/decrypt", data=ENC_MAGIC + PLAIN, form={"requestorAccount": "hong"})
check("복호화 성공", r.status_code == 200 and r.content == PLAIN, r.status_code)
r = call("/api/drm/decrypt", data=PLAIN, form={"requestorAccount": "hong"})
check("일반 파일이면 -200 을 400 으로", r.status_code == 400, (r.status_code, r.text[:120]))
body = r.json()
check("-200 본문 그대로 전달(부르는 쪽이 분기)", body["result"] == "-200" and "대상" in body["result_msg"], body)

print("[4] 비밀문서 확인(drmSecretAPI) — JSON 을 그대로")
r = call("/api/drm/secret", data=b"has SECRET mark", form={"requestorAccount": "hong"})
check("S_DOC", r.status_code == 200 and r.json()["result"] == "S_DOC", r.text[:120])
r = call("/api/drm/secret", data=b"normal doc", form={"requestorAccount": "hong"})
check("N_DOC", r.json()["result"] == "N_DOC", r.text[:120])

print("[5] 정책(drmPolicyAPI) — decodeType 필수·검증")
r = call("/api/drm/policy", form={"requestorAccount": "hong", "decodeType": "encrypt"})
check("encrypt", r.status_code == 200 and r.content == ENC_MAGIC + PLAIN)
check("decodeType 전달", GW["calls"][-1]["qs"].get("decodeType") == "encrypt", GW["calls"][-1]["qs"])
r = call("/api/drm/policy", data=ENC_MAGIC + PLAIN, form={"requestorAccount": "hong", "decodeType": "decrypt"})
check("decrypt", r.status_code == 200 and r.content == PLAIN)
r = call("/api/drm/policy", form={"requestorAccount": "hong", "decodeType": "delete"})
check("잘못된 decodeType 은 422", r.status_code == 422, r.status_code)
r = call("/api/drm/policy", form={"requestorAccount": "hong"})
check("decodeType 누락은 422", r.status_code == 422, r.status_code)

print("[6] requestorAccount — 비우면 서버 기본 계정, 그것도 없으면 400")
n0 = len(GW["calls"])
r = call("/api/drm/secret", data=b"x")
check("기본 계정으로 호출", r.status_code == 200 and GW["calls"][-1]["qs"]["requestorAccount"] == "default_account",
      GW["calls"][-1]["qs"] if len(GW["calls"]) > n0 else r.text[:120])
drm.configure(account="")
n1 = len(GW["calls"])
r = call("/api/drm/secret", data=b"x")
check("계정이 아예 없으면 400 + Gateway 미호출", r.status_code == 400 and len(GW["calls"]) == n1, r.text[:120])
drm.configure(account="default_account")

print("[7] 파일 누락/빈 파일")
r = client.post("/api/drm/encrypt", data={"requestorAccount": "hong"})
check("파일 누락은 422", r.status_code == 422, r.status_code)
r = call("/api/drm/encrypt", data=b"", form={"requestorAccount": "hong"})
check("빈 파일은 400", r.status_code == 400, r.status_code)

print("[8] Gateway 오류 코드 매핑 — 본문은 그대로, HTTP 는 구분되게")
for mode, want_status, want_result in [("auth_error", 502, "-100"),
                                       ("business_error", 400, "-200"),
                                       ("server_error", 502, "-999"),
                                       ("http_500_json", 502, "-999")]:
    GW["mode"] = mode
    r = call("/api/drm/encrypt", form={"requestorAccount": "hong"})
    body = r.json()
    check(f"{mode} → {want_status}/{want_result}",
          r.status_code == want_status and body.get("result") == want_result and body.get("ok") is False,
          (r.status_code, body))

print("[9] 깨진 응답/빈 스트림 — 서버가 죽지 않고 오류로 알린다")
GW["mode"] = "malformed"
r = call("/api/drm/secret", form={"requestorAccount": "hong"})
check("JSON 해석 불가 → 502", r.status_code == 502, (r.status_code, r.text[:120]))
GW["mode"] = "empty_stream"
r = call("/api/drm/decrypt", data=ENC_MAGIC + PLAIN, form={"requestorAccount": "hong"})
check("빈 파일 응답 → 502(0바이트 문서 방지)", r.status_code == 502, (r.status_code, r.text[:120]))

print("[10] 타임아웃 — 재시도 없이 한 번만 부르고 504")
GW["mode"] = "ok"
GW["sleep"] = 2.0
drm.configure(timeout=0.5)
n = len(GW["calls"])
t0 = time.perf_counter()
r = call("/api/drm/encrypt", form={"requestorAccount": "hong"})
elapsed = time.perf_counter() - t0
GW["sleep"] = 0.0
drm.configure(timeout=60)
check("504", r.status_code == 504, (r.status_code, r.text[:120]))
check("재시도하지 않는다(호출 1회)", len(GW["calls"]) == n + 1, len(GW["calls"]) - n)
check("제한시간 근처에서 끊는다", elapsed < 1.9, round(elapsed, 2))

print("[11] 파일명 안전 처리 — 경로/개행이 헤더로 새지 않는다")
GW["mode"] = "ok"
r = call("/api/drm/encrypt", filename="../../evil\r\nX: 1.xlsx", form={"requestorAccount": "hong"})
cd = r.headers.get("content-disposition", "")
check("응답 헤더에 경로 탈출 없음", r.status_code == 200 and "../" not in cd and "%2F" not in cd.replace("%2f", "%2F"), cd)
check("응답 헤더에 개행 없음", "\r" not in cd and "\n" not in cd)
sent_name = GW["calls"][-1]["filename"]
check("Gateway 로 보낸 파일명도 세탁", "/" not in sent_name and "\\" not in sent_name and "\r" not in sent_name, sent_name)

print("[12] 비밀은 로그에 남지 않는다 (keyCode 금지 — 규격 28)")
joined = "\n".join(_log_lines)
check("로그에 keyCode 값 없음", TEST_KEY not in joined)
check("로그에 keyCode 파라미터명도 없음", "keyCode" not in joined)
check("시작/성공/오류 이벤트는 남는다",
      "[문서보안] 시작" in joined and "[문서보안] 성공" in joined and "실패(gateway_error)" in joined)

print("[13] 키 미설정이면 503 으로 분명히 알린다(Gateway 미호출)")
drm.configure(api_key="")
n = len(GW["calls"])
r = call("/api/drm/encrypt", form={"requestorAccount": "hong"})
check("503", r.status_code == 503 and len(GW["calls"]) == n, (r.status_code, r.text[:120]))
drm.configure(api_key=TEST_KEY)

print("[14] /v1 별칭 — AX-Cell 이 쓰는 길")
r = call("/v1/drm/decrypt", data=ENC_MAGIC + PLAIN, form={"requestorAccount": "hong"})
check("/v1/drm/decrypt 동작", r.status_code == 200 and r.content == PLAIN)
h = client.get("/v1/drm/health").json()
check("health 에 설정 상태", h["ok"] and h["configured"] is True and h["service"] == "axcell-drm", h)
check("health 가 키 값을 내보내지 않는다", TEST_KEY not in json.dumps(h))
check("기존 기능 영향 없음(버전/수집)", client.get("/v1/models").status_code == 200
      and client.get("/logs/health").status_code == 200)

print("[15] 파일 크기 상한")
drm.configure(max_file_mb=1)
r = call("/api/drm/encrypt", data=b"x" * (1024 * 1024 + 100), form={"requestorAccount": "hong"})
check("상한 초과는 413", r.status_code == 413, r.status_code)
drm.configure(max_file_mb=200)


print("[16] Gateway 오류 JSON 은 그대로 돌려준다(사용자 지시 2026-08-26)")
# 규격 밖 필드가 함께 와도 버리지 않는다 — 그게 원인 단서다.
class _Extra(FakeGateway):
    pass
GW["mode"] = "extra_fields"
_orig_do_post = FakeGateway.do_POST
def _do_post_extra(self):
    if GW["mode"] != "extra_fields":
        return _orig_do_post(self)
    self.rfile.read(int(self.headers.get("content-length") or 0))
    GW["calls"].append({"qs": {}, "filename": "", "size": 0})
    self._json({"result": "-200", "result_msg": "복호화 대상 파일이 아닙니다.",
                "traceId": "MIP-77", "detail": {"reason": "NOT_DRM"}})
FakeGateway.do_POST = _do_post_extra
r = call("/api/drm/decrypt", form={"requestorAccount": "hong"})
body = r.json()
check("HTTP 400(-200 매핑)", r.status_code == 400, r.status_code)
check("gateway 에 원문 그대로", body.get("gateway", {}).get("traceId") == "MIP-77"
      and body["gateway"]["detail"]["reason"] == "NOT_DRM", body.get("gateway"))
check("정규화 필드도 유지", body["result"] == "-200" and "대상" in body["result_msg"], body)
FakeGateway.do_POST = _orig_do_post
GW["mode"] = "ok"

print("[17] JSON 이 아닌 오류 본문도 버리지 않는다(rawBody)")
GW["mode"] = "malformed"
r = call("/api/drm/secret", form={"requestorAccount": "hong"})
check("502", r.status_code == 502, r.status_code)
check("rawBody 에 본문 보존", "oops" in (r.json().get("rawBody") or ""), r.json())
GW["mode"] = "ok"

print("[18] DNS 실패는 timeout 이 아니라 dns 로 구분한다(실측 2026-08-26)")
import drm as _drm
_saved_base = _drm.GATEWAY_BASE_URL
_drm.configure(base_url="https://no-such-host-abc123.invalid/webapi")
r = call("/api/drm/decrypt", form={"requestorAccount": "hong"})
check("504", r.status_code == 504, r.status_code)
msg = r.json().get("error", "")
check("이름을 못 찾았다고 말해 준다(DNS)", "DNS" in msg or "찾지 못했" in msg, msg)
check("고칠 곳을 알려 준다(hosts/DNS/프록시)", "hosts" in msg or "DNS" in msg, msg)
check("로그 라벨이 dns", any("실패(dns)" in l for l in _log_lines[-6:]), _log_lines[-3:])
_drm.configure(base_url=_saved_base)

print("[19] health 로 DNS 를 미리 확인할 수 있다")
h = client.get("/api/drm/health").json()
check("기본은 DNS 확인 안 함(느려질 수 있어서)", "dns" not in h, h)
_drm.configure(base_url="https://no-such-host-abc123.invalid/webapi")
h = client.get("/api/drm/health?probe=1").json()
check("probe=1 이면 DNS 결과 포함", isinstance(h.get("dns"), dict), h.get("dns"))
check("안 풀리면 ok=false + 힌트", h["dns"]["ok"] is False and "hosts" in h["dns"]["hint"], h.get("dns"))
_drm.configure(base_url=_saved_base)


print("[20] 규격 v0.3 필수 파라미터 — ip 가 반드시 실린다")
import drm as _d
_d.configure(client_ip="10.20.30.40")
GW["calls"] = []
call("/api/drm/decrypt", data=ENC_MAGIC + PLAIN, form={"requestorAccount": "hong"})
q = GW["calls"][-1]["qs"]
check("필수 5종이 모두 있다(method/ip/keyCode/requestorAccount/policyGCode)",
      all(k in q for k in ("method", "ip", "keyCode", "requestorAccount", "policyGCode")), q)
check("ip 값이 설정대로", q.get("ip") == "10.20.30.40", q.get("ip"))
for m, path in (("drmEncryptAPI", "/api/drm/encrypt"), ("drmSecretAPI", "/api/drm/secret")):
    call(path, form={"requestorAccount": "hong"})
    check(f"{m} 에도 ip 포함", GW["calls"][-1]["qs"].get("ip") == "10.20.30.40", GW["calls"][-1]["qs"])
call("/api/drm/policy", form={"requestorAccount": "hong", "decodeType": "encrypt"})
check("drmPolicyAPI 에도 ip 포함", GW["calls"][-1]["qs"].get("ip") == "10.20.30.40")

print("[21] -100 이면 게이트웨이가 본 IP 를 뽑아 알려준다(규격 Error Code)")
_orig = FakeGateway.do_POST
def _ip_reject(self):
    self.rfile.read(int(self.headers.get("content-length") or 0))
    GW["calls"].append({"qs": {}, "filename": "", "size": 0})
    self._json({"result": "-100", "result_msg": "허용되지 않은 IP에서 호출하였습니다.203.0.113.77"})
FakeGateway.do_POST = _ip_reject
r = call("/api/drm/decrypt", form={"requestorAccount": "hong"})
b = r.json()
check("502", r.status_code == 502, r.status_code)
check("게이트웨이가 본 IP 추출", b.get("seenIp") == "203.0.113.77", b)
# 자동 교정이 한 번 돌아 ip 가 게이트웨이가 본 값으로 바뀐 뒤의 최종 실패 응답이다.
check("우리가 보낸 ip 도 함께(자동 교정 후 값)", b.get("sentIp") == "203.0.113.77", b.get("sentIp"))
check("-100 이면 한 번 재시도한다(호출 2회)", len(GW["calls"]) >= 2, len(GW["calls"]))
check("무엇을 맞춰야 하는지 안내", "API KEY 발급 시 등록한 IP" in (b.get("hint") or ""), b.get("hint"))
check("원문도 그대로", "허용되지 않은 IP" in (b.get("gateway", {}).get("result_msg") or ""), b.get("gateway"))
FakeGateway.do_POST = _orig
_d.configure(client_ip="")


print("[22] -100 이 알려준 IP 로 스스로 고쳐 성공한다(사용자가 손 안 대도 되게)")
_d.configure(client_ip="10.0.0.9")
_d.CLIENT_IP_LEARNED = ""
_orig2 = FakeGateway.do_POST
_state = {"n": 0}
def _reject_then_ok(self):
    body = self.rfile.read(int(self.headers.get("content-length") or 0))
    qs = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
    GW["calls"].append({"qs": qs, "filename": "", "size": 0})
    _state["n"] += 1
    if _state["n"] == 1:                       # 첫 호출: 등록 IP 와 달라 거절 + 본 IP 알려줌
        self._json({"result": "-100", "result_msg": "허용되지 않은 IP에서 호출하였습니다.203.0.113.77"})
    else:                                       # 교정된 ip 로 다시 오면 통과
        self._stream(ENC_MAGIC + PLAIN, "ok.xlsx")
FakeGateway.do_POST = _reject_then_ok
GW["calls"] = []
r = call("/api/drm/encrypt", form={"requestorAccount": "hong"})
check("최종 성공(200)", r.status_code == 200, (r.status_code, r.text[:120]))
check("두 번 호출(거절 → 교정 후 재시도)", len(GW["calls"]) == 2, len(GW["calls"]))
check("첫 호출은 원래 ip", GW["calls"][0]["qs"].get("ip") == "10.0.0.9", GW["calls"][0]["qs"].get("ip"))
check("재시도는 게이트웨이가 본 ip", GW["calls"][1]["qs"].get("ip") == "203.0.113.77", GW["calls"][1]["qs"].get("ip"))
check("교정값을 기억한다(.env 안내용)", _d.CLIENT_IP == "203.0.113.77", _d.CLIENT_IP)
_state["n"] = 5                                 # 이후 호출은 계속 성공 경로
call("/api/drm/secret", form={"requestorAccount": "hong"})
check("다음 호출부터는 교정된 ip 로 한 번에", GW["calls"][-1]["qs"].get("ip") == "203.0.113.77")
FakeGateway.do_POST = _orig2
_d.configure(client_ip="")
_d.CLIENT_IP_LEARNED = ""

print("[23] 이름 풀이 실패 시 등록된 VIP 로 붙는다(파드 설정 안 고쳐도 되게)")
import socket as _sock
_saved_gai = _sock.getaddrinfo
_d._DNS_FALLBACK_INSTALLED = False
_saved_base2, _saved_gwip = _d.GATEWAY_BASE_URL, _d.GATEWAY_IP
_d.configure(base_url="https://no-such-host-abc123.invalid/webapi", gateway_ip="127.0.0.1")
check("설치됨", _d.install_dns_fallback() is True)
try:
    infos = _sock.getaddrinfo("no-such-host-abc123.invalid", 443)
    check("안 풀리던 이름이 등록 IP 로 풀린다", "127.0.0.1" in {i[4][0] for i in infos}, infos[:1])
except Exception as err:
    check("안 풀리던 이름이 등록 IP 로 풀린다", False, err)
check("다른 이름은 건드리지 않는다(정상 경로 보존)",
      "127.0.0.1" in {i[4][0] for i in _sock.getaddrinfo("localhost", 80)})
try:
    _sock.getaddrinfo("another-missing-host-zzz.invalid", 443)
    check("무관한 미해석 이름은 그대로 실패", False, "예외가 안 났다")
except _sock.gaierror:
    check("무관한 미해석 이름은 그대로 실패", True)
_sock.getaddrinfo = _saved_gai
_d._DNS_FALLBACK_INSTALLED = False
_d.configure(base_url=_saved_base2, gateway_ip=_saved_gwip)

print("\n[24] 이름 풀이 실패를 기억한다(호출마다 DNS 대기로 10초씩 버리지 않게)")
# [실측 2026-08-26] 폐쇄망 파드에서 호출 하나가 10초씩 걸렸다. 쿠버네티스는 search 도메인 +
# ndots:5 라 안 풀리는 이름 한 번 물어보는 데만 그만큼 든다. 로그의 elapsed_ms=10012 가
# '게이트웨이가 느리다' 로 보였는데, 사실은 대부분이 DNS 대기였다.
_saved_gai = _sock.getaddrinfo
_saved_base3, _saved_gwip3 = _d.GATEWAY_BASE_URL, _d.GATEWAY_IP
_d._DNS_FALLBACK_INSTALLED = False
_d._DNS_DEAD_UNTIL = 0.0
_d.configure(base_url="https://no-such-host-abc123.invalid/webapi", gateway_ip="127.0.0.1")
tries = []


def _counting_gai(node, port, *a, **k):
    tries.append(str(node))
    return _saved_gai(node, port, *a, **k)


_sock.getaddrinfo = _counting_gai
_d.install_dns_fallback()
for _ in range(3):
    _sock.getaddrinfo("no-such-host-abc123.invalid", 443)
misses = [t for t in tries if t == "no-such-host-abc123.invalid"]
check("안 되는 이름은 한 번만 물어본다", len(misses) == 1, tries)
check("그 뒤로는 등록 IP 로 곧장 간다", tries.count("127.0.0.1") == 3, tries)
check("죽은 상태를 스스로 안다", _d.dns_is_dead() is True)
_sock.getaddrinfo = _saved_gai
_d._DNS_FALLBACK_INSTALLED = False
_d._DNS_DEAD_UNTIL = 0.0

print("\n[25] 끊긴 것과 못 간 것을 구분한다(고칠 곳이 다르다)")
check("RST 는 reset", _d._net_reason(ConnectionResetError(104, "Connection reset by peer"))[0] == "reset")
check("무응답은 timeout", _d._net_reason(TimeoutError("timed out"))[0] == "timeout")
check("이름 못 찾음은 dns", _d._net_reason(_sock.gaierror(-2, "Name or service not known"))[0] == "dns")
check("거부는 refused", _d._net_reason(ConnectionRefusedError(111, "refused"))[0] == "refused")

print("\n[26] 단계별 진단 — 밟은 만큼만 적는다")
_d.configure(base_url=GW_URL)
pr = _d.probe_gateway_stages(timeout=3.0)
names = [s["name"] for s in pr["stages"]]
check("이름 풀이 → TCP → HTTP 를 밟는다", names[:2] == ["이름 풀이", "TCP 연결"] and "HTTP 응답" in names, names)
check("붙는 서버면 HTTP 응답까지 OK",
      all(s.get("ok") is not False for s in pr["stages"]), pr["stages"])
check("단계마다 걸린 시간을 남긴다", any(s.get("ms") is not None for s in pr["stages"]))
_d.configure(base_url="https://127.0.0.1:9/webapi")      # 아무도 안 듣는 포트
pr2 = _d.probe_gateway_stages(timeout=3.0)
bad = [s for s in pr2["stages"] if s.get("ok") is False]
check("못 붙으면 그 단계가 경고로 남는다", bool(bad) and bad[0]["name"] == "TCP 연결", pr2["stages"])
# [회귀 2026-08-26] 예전 점검은 확인하지 못한 단계까지 OK 로 보여, 모든 호출이 실패하는
# 서버가 시작 화면상 멀쩡해 보였다. 확인 못 한 것을 OK 로 적지 않는 것이 이 진단의 핵심이다.
check("확인 못 한 단계를 OK 로 적지 않는다",
      not any(s.get("ok") is True for s in pr2["stages"] if s["name"] in ("TLS 연결", "HTTP 응답")))
check("무엇을 하면 되는지까지 적는다", any("출발지" in a or "방화벽" in a for a in pr2["advice"]), pr2["advice"])
_d.configure(base_url=_saved_base3, gateway_ip=_saved_gwip3)

print("\n[27] 사이드카가 있을 때 '범인인지' 를 숫자로 갈라낸다")
# [실측 2026-08-26] 사이드카가 있다는 것만으로 메시 탓을 하면 안 된다. 실제 서버에서 Envoy 는
# 확인됐지만 막은 흔적은 없었다 — 그때 '메시 설정을 고치세요' 라고 적었다면 애먼 곳을 며칠
# 고치게 만들었을 것이다. 붙어 보는 동안 어떤 숫자가 움직였는지로만 판정한다.
STATS = {"cluster.BlackHoleCluster.upstream_cx_total": 7,
         "cluster.PassthroughCluster.upstream_cx_total": 3,
         "cluster.PassthroughCluster.upstream_cx_connect_fail": 0,
         "cluster.PassthroughCluster.upstream_cx_connect_timeout": 0,
         "listener.0.0.0.0_15001.downstream_cx_total": 11}


class FakeEnvoy(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/server_info"):
            body = b'{"version":"1.24.1-dev/Clean/RELEASE","state":"LIVE"}'
        else:
            body = "".join("%s: %d\n" % (k, v) for k, v in STATS.items()).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


envoy = ThreadingHTTPServer(("127.0.0.1", 0), FakeEnvoy)
threading.Thread(target=envoy.serve_forever, daemon=True).start()
_saved_admin = _d.ENVOY_ADMIN
_d.ENVOY_ADMIN = "127.0.0.1:%d" % envoy.server_address[1]

mi = _d.mesh_info()
check("사이드카를 찾아낸다", mi["present"] is True and mi["adminOk"] is True, mi)
check("버전까지 읽는다", "1.24.1" in (mi.get("version") or ""), mi)
check("필요한 셈을 모두 읽는다",
      mi["blackhole"] == 7 and mi["passthrough"] == 3 and mi["outbound"] == 11, mi)


def verdict_after(changes):
    """붙어 보는 동안 숫자가 이렇게 움직였다면, 어떤 판정이 나오나."""
    base = _d.mesh_counters()
    for k, v in changes.items():
        STATS[k] += v
    out = {"mesh": dict(mi), "stages": [], "ip": "172.28.11.30", "port": 443,
           "host": "mipgw.lguplus.co.kr"}
    _d._mesh_verdict(out, base)
    for k, v in changes.items():          # 원상복구(다음 갈래에 영향 주지 않게)
        STATS[k] -= v
    out["advice"] = _d._probe_advice(out)
    return out


o = verdict_after({"cluster.BlackHoleCluster.upstream_cx_total": 2})
check("막은 연결이 오르면 '메시가 막음'", o["mesh"]["verdict"] == "blocked"
      and o["stages"][0]["ok"] is False, o["stages"])
check("추측이 아니라 증거(숫자)를 적는다", "7" in o["stages"][0]["detail"] and "9" in o["stages"][0]["detail"])
joined = " ".join(o["advice"])
check("방화벽 신청이 헛수고임을 알린다", "방화벽 신청을 해도 소용이 없습니다" in joined, o["advice"])
check("고치는 방법(어노테이션/ServiceEntry)까지 준다",
      "excludeOutboundIPRanges" in joined and "ServiceEntry" in joined, o["advice"])

o = verdict_after({"cluster.PassthroughCluster.upstream_cx_total": 3,
                   "cluster.PassthroughCluster.upstream_cx_connect_timeout": 3})
check("내보냈다가 실패하면 '메시 밖에서 막힘'", o["mesh"]["verdict"] == "outside", o["stages"])
joined = " ".join(o["advice"])
check("이때는 방화벽 쪽으로 안내한다", "보안팀에 넘길 때는" in joined and "SNAT" in joined, o["advice"])
check("메시 탓으로 몰지 않는다", "방화벽 신청을 해도 소용이 없습니다" not in joined, o["advice"])

o = verdict_after({"cluster.PassthroughCluster.upstream_cx_total": 3})
check("그냥 통과시켰으면 메시는 무죄", o["mesh"]["verdict"] == "passed"
      and o["stages"][0]["ok"] is True, o["stages"])

o = verdict_after({})
check("아무 숫자도 안 움직이면 '거치지 않는 연결'", o["mesh"]["verdict"] == "bypassed"
      and o["stages"][0]["ok"] is None, o["stages"])
check("모르는 것을 안다고 하지 않는다", "확인 못함" == o["stages"][0]["why"], o["stages"])

_d.ENVOY_ADMIN = "127.0.0.1:1"                        # 사이드카가 없는 파드
check("없으면 없다고 한다", _d.mesh_info()["present"] is False)
_d.ENVOY_ADMIN = _saved_admin
envoy.shutdown()

print("\n[28] 심층 진단 — 결론이 사실과 어긋나지 않는다")
# [실측 2026-08-26] 이 결론 부분에서 거짓말이 두 번 나왔다.
#  (1) 위에 찍힌 글자를 찾아 결론을 내다가, **이름 풀이부터 실패한 상황에 "TLS 응답이 없다"** 고 적었다.
#  (2) MIPNetworkError 가 MIPGatewayError 의 자식이라, **연결조차 못 했는데 "망은 뚫려 있다"** 고 적었다.
# 진단이 거짓말을 하면 없느니만 못하다 — 갈래마다 못 박아 둔다.
MESHLESS = {"present": False}


def verdict(**facts):
    base = {"dns": True, "tcp": True, "tlsOk": False, "first": "", "call": "skip",
            "meshBlocked": False, "meshPresent": False}
    base.update(facts)
    return " ".join(_d._diagnose_verdict(base, MESHLESS, "172.28.11.30", "mipgw.example", 443))


v = verdict(dns=False)
check("이름 풀이 실패면 그 얘기만 한다", "이름 풀이부터 실패" in v and "ClientHello" not in v, v)
check("아래 단계를 시도한 척하지 않는다", "시도조차 못" in v, v)

v = verdict(tcp=False)
check("TCP 부터 안 되면 TCP 얘기", "TCP 부터 안 붙습니다" in v, v)

v = verdict(first="silent")
check("한 바이트도 안 오면 drop 판정", "한 바이트도 안 옵니다" in v and "drop" in v, v)
check("보안팀에 보낼 문장을 붙여 준다", "보안팀에 넘길 때는" in v, v)

v = verdict(first="silent", meshBlocked=True)
check("사이드카 없는데 메시 탓 안 한다", "사이드카" not in v, v)
v2 = " ".join(_d._diagnose_verdict(
    {"dns": True, "tcp": True, "tlsOk": False, "first": "silent", "call": "skip",
     "meshBlocked": True, "meshPresent": True}, {"present": True}, "1.2.3.4", "h", 443))
check("사이드카가 막았으면 방화벽으로 안 보낸다",
      "사이드카" in v2 and "보안팀에 넘길 때는" not in v2, v2)

v = verdict(first="alert")
check("거절(Alert)은 drop 과 구분한다", "명시적으로 거절" in v and "보안팀에 넘길 때는" not in v, v)

v = verdict(first="serverhello")
check("ServerHello 오면 TLS 는 살아 있다고", "TLS 는 살아 있습니다" in v, v)

v = verdict(first="http")
check("평문 응답이면 포트가 TLS 가 아니라고", "TLS 가 아닙니다" in v, v)

v = verdict(call="gatewayError")
check("응답이 오면 '도달한다' 로 마무리", "도달합니다" in v, v)
v = verdict(call="fail", first="silent")
check("연결 실패를 '도달' 로 읽지 않는다", "도달합니다" not in v, v)

print("\n[28-2] 심층 진단을 실제로 한 번 돌린다(붙는 게이트웨이 상대로)")
_saved_base4 = _d.GATEWAY_BASE_URL
_d.configure(base_url=GW_URL, account="default_account")
report = "\n".join(_d.deep_diagnose(timeout=2.0, do_call=True))
for section in ("A. 실행 환경", "B. 네트워크 기본", "C. 사이드카", "D. 게이트웨이까지 단계별",
                "E. 다른 곳은 되는지", "F. 실제 게이트웨이 호출", "G. 정리"):
    check("%s 가 있다" % section, section in report, report[:200])
check("붙는 곳이면 '도달합니다' 로 끝난다", "도달합니다" in report, report[-400:])
check("키 원문은 절대 안 찍는다", TEST_KEY not in report and "지문" in report, "키가 노출됨")
check("단계마다 걸린 시간을 남긴다", "ms)" in report)
_d.configure(base_url=_saved_base4)

print("\n[29] 실측에서 드러난 오판 3건을 못 박는다")
# [실측 2026-08-26 · 실제 폐쇄망 파드] 진단이 "이 연결은 사이드카를 거치지 않습니다" 라고
# 단정했는데, 사실은 **셈을 하나도 못 읽은** 것이었다(사이드카 버전 차이로 stats filter 가
# 안 걸림). 그 한 줄 때문에 사이드카가 무죄로 읽혔다. 못 읽은 것은 못 읽었다고 적어야 한다.
CLUSTERS = """PassthroughCluster::observability_name::PassthroughCluster
PassthroughCluster::172.28.11.30:443::cx_active::2
PassthroughCluster::172.28.11.30:443::cx_connect_fail::0
PassthroughCluster::172.28.11.30:443::cx_total::2
PassthroughCluster::172.28.11.30:443::rq_error::0
BlackHoleCluster::observability_name::BlackHoleCluster
"""


class FakeEnvoy2(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/server_info"):
            body = b'{"version":"1.24.1-dev","state":"LIVE"}'
        elif self.path.startswith("/clusters"):
            body = CLUSTERS.encode()
        else:
            body = b""            # 실제 파드처럼 stats filter 가 아무것도 안 준다
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


envoy2 = ThreadingHTTPServer(("127.0.0.1", 0), FakeEnvoy2)
threading.Thread(target=envoy2.serve_forever, daemon=True).start()
_saved_admin2 = _d.ENVOY_ADMIN
_d.ENVOY_ADMIN = "127.0.0.1:%d" % envoy2.server_address[1]

c = _d.mesh_counters()
check("stats 가 비어도 /clusters 로 채운다", c["passthrough"] == 2 and c["passFail"] == 0, c)

dest = _d.cluster_counters("172.28.11.30", 443)
check("목적지별 셈을 읽는다", dest.get("cx_total") == 2 and dest.get("cx_connect_fail") == 0, dest)
check("숫자가 아닌 줄은 건너뛴다", "observability_name" not in dest, dest)

# Envoy 가 밖까지 TCP 를 성공시켰다면, 결론이 그 사실을 말해야 한다
v = " ".join(_d._diagnose_verdict(
    {"dns": True, "tcp": True, "tlsOk": False, "first": "silent", "call": "skip",
     "meshBlocked": False, "meshPresent": True, "tcpMeaningless": True,
     "envoyTried": 2, "envoyFailed": 0}, {"present": True}, "172.28.11.30", "h", 443))
check("나가는 TCP 는 성공했다는 사실을 앞세운다", "TCP 연결에 성공" in v, v)
check("막힌 곳이 TLS 단계임을 짚는다", "TLS 단계" in v, v)
check("그래도 보안팀 문구는 붙여 준다", "보안팀에 넘길 때는" in v, v)

# Envoy 실측이 없으면, 대조군 경고라도 남겨야 한다
v2 = " ".join(_d._diagnose_verdict(
    {"dns": True, "tcp": True, "tlsOk": False, "first": "silent", "call": "skip",
     "meshBlocked": False, "meshPresent": True, "tcpMeaningless": True,
     "envoyTried": None, "envoyFailed": None}, {"present": True}, "1.2.3.4", "h", 443))
check("대조군까지 붙었으면 'TCP OK 는 증거 아님' 을 알린다", "도달 증거가 아닙니다" in v2, v2)

_d.ENVOY_ADMIN = _saved_admin2
envoy2.shutdown()

print("\n[30] 파일을 다시 올리지 않고도 되물을 수 있다")
# [사용자 지시 2026-08-26] "왜 계속 마지막이냐" — 새 질문이 생길 때마다 코드를 고쳐 올려야 하는
# 구조가 원인이었다. 폐쇄망에서 그 비용이 매번 크다. 자주 묻는 것은 주소창으로 끝나게 한다.
gw_host, gw_port = GW_URL.split("//")[1].split("/")[0].split(":")

out = "\n".join(_d.probe_target("%s:%s" % (gw_host, gw_port), timeout=2.0))
check("아무 주소나 같은 방식으로 찔러본다", "TCP" in out and "OK" in out, out)
check("단계를 다 밟는다", "TLS" in out and "첫 응답 바이트" in out and "평문 HTTP" in out, out)

bad = "\n".join(_d.probe_target("; whoami"))
check("이상한 입력은 형식 안내로 막는다", "호스트:포트" in bad and "TCP" not in bad, bad)
bad = "\n".join(_d.probe_target("127.0.0.1:99999"))
check("포트 범위를 지킨다", "호스트:포트" in bad, bad)
slow = "\n".join(_d.probe_target("127.0.0.1:%s" % gw_port, timeout=999))
check("제한시간을 묶어 둔다(오래 붙잡히지 않게)", "제한 15.0초" in slow, slow[:80])

check("Envoy 조회는 정해진 경로만", set(_d.ENVOY_PATHS) == {
    "server_info", "clusters", "listeners", "stats", "runtime", "certs", "ready"}, _d.ENVOY_PATHS)
check("임의 경로는 못 넣는다", "../etc/passwd" not in _d.ENVOY_PATHS)

print(chr(10) + "[31] 브라우저 없이 글자 한 줄로도 물어볼 수 있다")
# [사용자 지시 2026-08-26] "내부도 컨테이너 구조인데 주소를 어떻게 열어" — 맞는 지적이다.
# 이 서버는 파드 안에서 돌고 사용자에겐 터미널 하나뿐이라, 엔드포인트만 열어 두면 무용지물이다.
# 그래서 같은 답을 answer() 한 함수로 모으고, CLI(--ask)/파일(ask.txt)/HTTP 가 전부 이걸 부른다.
check("help 가 사용법을 준다", "diagnose" in " ".join(_d.answer("help")), _d.answer("help"))
check("빈 질문도 사용법으로 받는다", "probe" in " ".join(_d.answer("")))
out = " ".join(_d.answer("probe %s" % GW_URL.split("//")[1].split("/")[0]))
check("probe 를 알아듣는다", "찔러보기" in out and "TCP" in out, out[:120])
check("주소만 줘도 알아듣는다", "찔러보기" in " ".join(_d.answer(GW_URL.split("//")[1].split("/")[0])))
check("모르는 말은 되묻는다", "모르겠습니다" in " ".join(_d.answer("이거 왜 안돼요")))
check("envoy 는 정해진 것만", "중 하나를 주세요" in " ".join(_d.answer("envoy ../../etc")))
print(chr(10) + "[32] 되물을 수 없는 환경 — 알아서 다 찍는다")
# [사용자 지시 2026-08-26] "한 줄도 못 넣어. 그냥 돌리는 거라서" — 사용자는 실행하고 콘솔을
# 볼 뿐이다. 추가로 뭘 쳐 보라고 할 수 없으니, 필요한 건 전부 자동으로 남아야 한다.
check("환경변수를 남기되 비밀은 가린다",
      all("(가림" in e or "KEY" not in e.upper() for e in _d.interesting_env()), _d.interesting_env()[:5])
ports = _d.proc_listeners()
check("듣는 포트를 읽는다(리눅스면 목록, 윈도우면 빈 목록)", isinstance(ports, list), ports)
check("기본 게이트웨이는 문자열로", isinstance(_d.default_route(), str))
check("stats 는 서버측 filter 를 안 믿는다", isinstance(_d.envoy_stat_lines("cx_total"), list))

# 실패한 그 순간을 자동으로 남긴다 — 다만 게이트웨이가 답을 준 실패까지 도배하면 안 된다
_d._AUTODIAG["at"] = 0.0
_d.autodiagnose_on_failure("gateway_error", "t1")
check("게이트웨이가 답한 실패에는 진단을 안 돌린다", _d._AUTODIAG["at"] == 0.0)
_d._AUTODIAG["every"] = 99999.0
_d.autodiagnose_on_failure("reset", "t2")
first = _d._AUTODIAG["at"]
check("망 실패에는 진단을 돌린다", first > 0)
_d.autodiagnose_on_failure("reset", "t3")
check("연달아 실패해도 도배하지 않는다", _d._AUTODIAG["at"] == first)
_d._AUTODIAG["every"], _d._AUTODIAG["at"] = 600.0, 0.0
print(chr(10) + "[33] 실측 3차에서 드러난 것")
# [실측 2026-08-26 3차] (1) Envoy 클러스터를 **붙어보기 전에** 읽어 늘 비어 있었다.
# Envoy 는 처음 붙을 때 그 목적지 클러스터를 만든다 — 2차에 값이 보인 건 앞선 점검 덕분이었다.
# (2) 실제 TLS 3종 중 2종이 RST 였는데 결론은 손으로 만든 ClientHello(무응답)만 보고
# '조용히 버려짐' 이라 했다. 사용자가 겪는 것은 앞쪽이다.
codes_reset = {"기본(최대 1.3)": "reset", "TLS 1.2 고정": "reset", "SNI 없이": "timeout"}
v = " ".join(_d._diagnose_verdict(
    {"dns": True, "tcp": True, "tlsOk": False, "first": "silent", "call": "skip",
     "meshBlocked": False, "meshPresent": True, "tcpMeaningless": True,
     "envoyTried": 2, "envoyFailed": 0, "tlsCodes": codes_reset},
    {"present": True}, "172.28.11.30", "mipgw.example", 443))
check("RST 를 결론에 반영한다", "끊깁니다(RST)" in v, v)
check("무응답만 보고 drop 이라 하지 않는다", "조용히 버려지는 중" not in v, v)
check("SNI 유무로 반응이 갈리면 그걸 짚는다", "SNI" in v and "반응이 다릅니다" in v, v)
check("나가는 TCP 성공 사실을 앞세운다", "TCP 연결에 성공" in v, v)

# RST 가 하나도 없으면 예전 판정(조용히 버려짐)이 그대로여야 한다
v2 = " ".join(_d._diagnose_verdict(
    {"dns": True, "tcp": True, "tlsOk": False, "first": "silent", "call": "skip",
     "meshBlocked": False, "meshPresent": False, "tcpMeaningless": False,
     "envoyTried": None, "envoyFailed": None,
     "tlsCodes": {"기본(최대 1.3)": "timeout"}}, {"present": False}, "1.2.3.4", "h", 443))
check("RST 가 없으면 drop 판정 유지", "조용히 버려지는 중" in v2, v2)

# TLS 변형은 원인 코드까지 돌려줘야 한다(결론이 그걸로 갈린다)
gw_host, gw_port = GW_URL.split("//")[1].split("/")[0].split(":")
tri = _d._tls_try_variants(gw_host, int(gw_port), gw_host, 2.0)
check("TLS 변형마다 (이름, 결과, 원인코드)", all(len(x) == 3 for x in tri), tri)
print(chr(10) + "[34] 한 번에 끝나게 — 원시 증거와 예외 안전")
# [사용자 지시 2026-08-27] 매 회차 새 업로드를 만든 건 **내 분석 코드의 버그**였다
# (필터 미적용을 '변화 없음' 으로 단정 / 클러스터를 붙기 전에 읽음 / RST 무시).
# 결론만 적으면 그 결론이 틀렸을 때 또 올려야 한다. 원문이 함께 남으면 안 올려도 된다.
rep_out = "\n".join(_d.deep_diagnose(timeout=1.5, do_call=False))
check("원시 증거 구간이 있다", "H. 원시 증거" in rep_out, rep_out[-300:])
check("결론은 원시 증거 뒤에도 살아 있다", rep_out.index("H. 원시 증거") < rep_out.index("G. 정리"))
check("환경변수 원문을 남긴다", "[env]" in rep_out)
check("같은 시험을 두 번 한다", "5-2) 한 번 더 해보면" in rep_out or "1) 이름 풀이" in rep_out)

# 중간이 터져도 앞부분은 살아야 한다 — 한 회차가 통째로 날아가면 또 올려야 한다
_saved = _d._tls_try_variants


def _boom(*a, **k):
    raise RuntimeError("일부러 낸 오류")


_d._tls_try_variants = _boom
broken = _d.deep_diagnose(timeout=1.0, do_call=False)
_d._tls_try_variants = _saved
check("터져도 앞 구간은 남는다", any("A. 실행 환경" in l for l in broken), len(broken))
check("어디서 터졌는지 알려준다", any("중간에 멈췄습니다" in l for l in broken))
check("추적 내용까지 남긴다", any("일부러 낸 오류" in l for l in broken))

# SNI 세 갈래를 시험해야 '무엇을 보고 끊는지' 가 갈린다
gw_host, gw_port = GW_URL.split("//")[1].split("/")[0].split(":")
labels = [l for l, _, _ in _d._tls_try_variants(gw_host, int(gw_port), gw_host, 2.0)]
check("SNI 정상/없음/다른이름 세 갈래", "SNI 없이" in labels and "다른 SNI" in labels, labels)
print(chr(10) + "[35] 실패 시 자동 진단이 파일로도 남는다")
# [실측 2026-09-02] 시작 진단은 logs/_diagnostics 에 저장되는데 실패 순간의 자동 진단은
# 콘솔에만 찍혔다. 서버가 8/27 이후 재시작이 없자 "진단 파일이 8/27까지만 있다"가 됐고,
# 정작 오늘 실패의 진단은 콘솔과 함께 흘러가 버렸다. 파일로도 남긴다.
import pathlib as _pl
import tempfile as _tf
import time as _time2
_dir = _tf.mkdtemp(prefix="autodiag_")
_saved_diag_fn = _d.deep_diagnose
_d.deep_diagnose = lambda *a, **k: ["진단내용 한 줄"]
_d.AUTODIAG_SAVE_DIR = _dir
_d._AUTODIAG["at"] = 0.0
_d.autodiagnose_on_failure("reset", "trc123")
files = []
for _ in range(50):
    files = list(_pl.Path(_dir).glob("diagnose_fail_*trc123*.txt"))
    if files:
        break
    _time2.sleep(0.1)
check("파일이 생긴다(이름에 trace 포함)", bool(files), _dir)
if files:
    check("진단 내용이 그대로 담긴다", files[0].read_text("utf-8") == "진단내용 한 줄")
_d.AUTODIAG_SAVE_DIR = ""
_d.deep_diagnose = _saved_diag_fn
_d._AUTODIAG["at"] = 0.0
_mainsrc = io.open(str(_pl.Path(__file__).parent / "main.py"), encoding="utf-8").read()
check("main 이 켤 때 저장 폴더를 채워 준다", "AUTODIAG_SAVE_DIR = str(Path(root)" in _mainsrc)

gw_server.shutdown()
print("\n" + ("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL"))
sys.exit(1 if fails else 0)

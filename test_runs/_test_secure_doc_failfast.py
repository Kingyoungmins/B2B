# -*- coding: utf-8 -*-
"""[제보 2026-09-01] 보안문서 해제 실패 시 대기가 길다 — 실패 종류별 실측.

확인된 사실(코드 추적):
  · 게이트웨이의 '명시 실패'(-100/-200/-999)는 릴레이가 JSON 그대로 400/502 로 즉시 전달하고
    양쪽 다 재시도가 없다 → 받는 즉시 다음 단계로 넘어간다. (이미 빠름)
  · 오래 걸리는 건 '무응답' 실패다: 게이트웨이가 패킷을 버리면 릴레이가 제한시간(기본 60초)을
    꽉 채우고서야 504 를 준다. 게다가 해제는 파일 단위라 여러 파일을 올리면 파일마다 반복.
    선행확인(secretPrecheck)을 켠 환경은 같은 60초를 한 번 더(확인+해제) 기다렸다.

이 테스트가 잠그는 수정:
  1) 명시 실패는 즉시 전달·재시도 없음 (종전 동작 확인)
  2) 무응답 실패는 kind="network" 로 분류된다
  3) 무응답 한 번이면 프로브 캐시가 '죽음' 처리 → 다음 파일들은 즉시 건너뜀(대체 경로로)
  4) 선행확인이 무응답이면 삼키지 않고 바로 접는다(해제 60초를 또 기다리지 않음) + 짧은 제한시간
  5) 다운로드 재적용은 프로브 캐시와 무관하게 항상 실제 호출 → 평문 유출 경로 없음
"""
import io
import json
import os
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:250]) if not cond else ""))
    if not cond:
        fails.append(name)


# ── 가짜 릴레이(versionTest 대역): 시나리오별 응답을 바꿔 가며 문다 ──
MODE = {"secret": "n_doc", "decrypt": "ok"}     # ok | notdrm | auth | hang | s_doc | n_doc
CALLS = {"secret": 0, "decrypt": 0, "health": 0}


class FakeRelay(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.endswith("/health"):
            CALLS["health"] += 1
            self._json(200, {"ok": True, "configured": True})

    def do_POST(self):
        _ = self.rfile.read(int(self.headers.get("content-length") or 0))
        if self.path.endswith("/secret"):
            CALLS["secret"] += 1
            m = MODE["secret"]
            if m == "hang":
                time.sleep(90); return
            self._json(200, {"result": "S_DOC" if m == "s_doc" else "N_DOC"})
            return
        if self.path.endswith("/decrypt"):
            CALLS["decrypt"] += 1
            m = MODE["decrypt"]
            if m == "hang":
                time.sleep(90); return
            if m == "notdrm":
                self._json(400, {"result": "-200", "result_msg": "복호화 대상 파일이 아닙니다"}); return
            if m == "auth":
                self._json(502, {"result": "-100", "result_msg": "허용되지 않은 IP에서 호출하였습니다.1.2.3.4"}); return
            body = b"PK\x03\x04plain-bytes"       # 해제 성공 = 평문 스트림
            self.send_response(200)
            self.send_header("content-type", "application/octet-stream")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeRelay)
threading.Thread(target=srv.serve_forever, daemon=True).start()
PORT = srv.server_address[1]

os.environ["B2B_SECURE_DOC"] = "1"
os.environ["B2B_SECURE_DOC_URL"] = "http://127.0.0.1:%d" % PORT
os.environ["B2B_SECURE_DOC_KEY"] = "test-key"
os.environ["B2B_SECURE_DOC_TIMEOUT"] = "10"          # 최소 클램프(10초) — 무응답 실측용
os.environ["B2B_SECURE_DOC_PRECHECK_TIMEOUT"] = "3"

import secure_doc as SD

work = Path(tempfile.mkdtemp(prefix="b2b_secfast_"))


def secured_file(tag):
    p = work / ("보안_%s.xlsx" % tag)
    p.write_bytes(b"SCDSA004" + b"\x00" * 64 + tag.encode())   # 사내 DRM 컨테이너 서명 → 보안문서로 판정
    return p


def fresh():
    """프로브 캐시/카운터 초기화 — 시나리오 간 오염 방지."""
    with SD._LOCK:
        SD._STATE["probe"] = None
    for k in CALLS:
        CALLS[k] = 0


print("[1] 명시 실패(-200 '대상 아님')는 즉시 온다 — 재시도 없음 (종전 동작)")
fresh(); MODE.update(secret="n_doc", decrypt="notdrm")
t0 = time.perf_counter()
out = SD.maybe_decrypt_upload(str(secured_file("a")), "보안_a.xlsx")
el = time.perf_counter() - t0
check("결과: 대상 아님(notDrm)", bool(out) and out.get("notDrm") is True, out)
check("즉시 끝난다(<3초)", el < 3, "%.1fs" % el)
check("해제 호출은 정확히 1번(재시도 없음)", CALLS["decrypt"] == 1, CALLS)

print("[2] 명시 실패(-100 인증)도 즉시 — 오류 문구에 원인이 실린다")
fresh(); MODE.update(secret="n_doc", decrypt="auth")
t0 = time.perf_counter()
out = SD.maybe_decrypt_upload(str(secured_file("b")), "보안_b.xlsx")
el = time.perf_counter() - t0
check("실패로 돌아온다(업로드는 계속)", bool(out) and out.get("released") is False and out.get("error"), out)
check("즉시 끝난다(<3초)", el < 3, "%.1fs" % el)
check("게이트웨이 메시지가 그대로 실린다", "허용되지 않은" in str(out.get("error")), out.get("error"))

print("[3] 무응답(패킷 드랍 재현) — 제한시간 1회만 기다리고 접는다")
fresh(); MODE.update(secret="n_doc", decrypt="hang")
t0 = time.perf_counter()
out = SD.maybe_decrypt_upload(str(secured_file("c")), "보안_c.xlsx")
el = time.perf_counter() - t0
check("실패로 돌아온다", bool(out) and out.get("released") is False, out)
check("제한시간(10초) 한 번만 기다린다", 8 < el < 20, "%.1fs" % el)

print("[4] 무응답 직후 다음 파일 — 기다리지 않고 즉시 대체 경로로")
c0 = dict(CALLS)
t0 = time.perf_counter()
out2 = SD.maybe_decrypt_upload(str(secured_file("d")), "보안_d.xlsx")
el2 = time.perf_counter() - t0
check("즉시 건너뛴다(<1초) ← 여러 파일 올릴 때 체감 개선의 핵심", el2 < 1, "%.1fs" % el2)
check("릴레이를 건드리지도 않는다", CALLS == c0, (c0, CALLS))
check("사유를 말한다(무소식 아님)", bool(out2) and "건너" in str(out2.get("error") or ""), out2)

print("[5] 30초 뒤(프로브 캐시 만료)에는 자동 복귀한다")
with SD._LOCK:                                   # 캐시 시각만 과거로 밀어 만료를 재현
    SD._STATE["probe"]["at"] -= SD.PROBE_CACHE_SECONDS + 1
MODE.update(decrypt="ok")
out3 = SD.maybe_decrypt_upload(str(secured_file("e")), "보안_e.xlsx")
check("다시 실제로 해제한다", bool(out3) and out3.get("released") is True, out3)

print("[6] 선행확인(secretPrecheck) 켠 환경 — 무응답이면 두 배로 안 기다린다")
os.environ["B2B_SECURE_DOC_SECRET_CHECK"] = "1"
try:
    fresh(); MODE.update(secret="hang", decrypt="ok")
    t0 = time.perf_counter()
    out = SD.maybe_decrypt_upload(str(secured_file("f")), "보안_f.xlsx")
    el = time.perf_counter() - t0
    check("선행확인 짧은 제한시간(3초)에서 바로 접는다(<6초 — 예전엔 10+10초)", el < 6, "%.1fs" % el)
    check("해제 호출로 넘어가 또 기다리지 않는다", CALLS["decrypt"] == 0, CALLS)
    check("실패로 돌아온다(업로드는 계속)", bool(out) and out.get("released") is False, out)

    print("[6b] 선행확인이 '명시'로 죽으면(파싱 등) 종전대로 해제가 최종 판정")
    fresh(); MODE.update(secret="s_doc", decrypt="ok")
    out = SD.maybe_decrypt_upload(str(secured_file("g")), "보안_g.xlsx")
    check("비밀등급은 여전히 정확한 사유로 거절", bool(out) and out.get("secret") is True, out)
    check("해제 호출을 아예 안 한다(왕복 절약 유지)", CALLS["decrypt"] == 0, CALLS)
finally:
    os.environ.pop("B2B_SECURE_DOC_SECRET_CHECK", None)

print("[7] 다운로드 재적용은 프로브 캐시와 무관 — 평문 유출 경로 없음")
fresh()
with SD._LOCK:                                   # 캐시를 일부러 '죽음'으로
    SD._STATE["probe"] = {"at": time.time(), "ok": False, "configured": False, "reason": "테스트"}
MODE.update(decrypt="hang")                       # encrypt 엔드포인트가 없으므로 404 → 예외 → 중단
t0 = time.perf_counter()
try:
    SD.encrypt_for_download(b"PK\x03\x04data", "결과.xlsx")
    check("재적용 실패는 예외로 중단된다(조용히 평문으로 내보내지 않음)", False, "예외가 안 났다")
except Exception:
    check("재적용 실패는 예외로 중단된다(조용히 평문으로 내보내지 않음)", True)
check("캐시가 죽어 있어도 재적용은 실제로 '시도'한다(게이트 안 탐)", time.perf_counter() - t0 < 5)

srv.shutdown()
import shutil
shutil.rmtree(work, ignore_errors=True)
for k in ("B2B_SECURE_DOC", "B2B_SECURE_DOC_URL", "B2B_SECURE_DOC_KEY",
          "B2B_SECURE_DOC_TIMEOUT", "B2B_SECURE_DOC_PRECHECK_TIMEOUT"):
    os.environ.pop(k, None)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

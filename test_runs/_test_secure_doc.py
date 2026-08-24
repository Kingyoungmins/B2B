# -*- coding: utf-8 -*-
"""보안문서(secure_doc) 계약 테스트 — Excel·실제 Gateway 불필요, 수 초.

실행: python test_runs/_test_secure_doc.py

가짜 릴레이 서버(versionTest 의 /v1/drm/* 계약과 같은 모양)를 이 프로세스에 띄우고,
secure_doc 모듈과 serve_b2b 의 다운로드 훅(_secure_outgoing_data)까지 실제 HTTP 로 검증한다.
릴레이 서버 자체의 계약 테스트는 versionTest/test_drm_service.py 에 따로 있다.
"""
import io
import json
import os
import re
import shutil
import sys
import tempfile
import threading
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


# ── 가짜 릴레이 (versionTest /v1/drm/* 와 같은 계약) ──────────────────────
ENC_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1MIPENC1:"   # OLE 머리 + 표식(실물 모양)
GW = {"mode": "ok", "calls": [], "configured": True}


def _file_part(body, content_type):
    m = re.search(r"boundary=([^;]+)", content_type or "")
    boundary = ("--" + m.group(1).strip()).encode() if m else b""
    for part in body.split(boundary):
        if b'name="file"' in part:
            head, _, payload = part.partition(b"\r\n\r\n")
            return payload.rsplit(b"\r\n", 1)[0]
    return b""


def _form_value(body, content_type, field):
    m = re.search(r"boundary=([^;]+)", content_type or "")
    boundary = ("--" + m.group(1).strip()).encode() if m else b""
    marker = ('name="%s"' % field).encode()
    for part in body.split(boundary):
        if marker in part and b'filename="' not in part:
            head, _, payload = part.partition(b"\r\n\r\n")
            return payload.rsplit(b"\r\n", 1)[0].decode("utf-8", "replace")
    return ""


class FakeRelay(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, status=200):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _stream(self, data):
        self.send_response(200)
        self.send_header("content-type", "application/octet-stream")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.endswith("/v1/drm/health"):
            self._json({"ok": True, "service": "axcell-drm", "configured": GW["configured"]})
            return
        self.send_error(404)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("content-length") or 0))
        blob = _file_part(body, self.headers.get("content-type"))
        op = self.path.rsplit("/", 1)[-1].split("?")[0]
        GW["calls"].append({"op": op, "size": len(blob), "key": self.headers.get("Api-Key", ""),
                            "account": _form_value(body, self.headers.get("content-type"), "requestorAccount")})
        if GW["mode"] == "server_down":
            self._json({"ok": False, "result": "-999", "result_msg": "시스템에 문제가 발생하였습니다."}, status=502)
            return
        if op == "decrypt":
            if blob.startswith(ENC_MAGIC):
                self._stream(blob[len(ENC_MAGIC):])
            else:
                self._json({"ok": False, "result": "-200", "result_msg": "복호화 대상 파일이 아닙니다."}, status=400)
            return
        if op == "encrypt":
            self._stream(ENC_MAGIC + blob)
            return
        self.send_error(404)


relay = ThreadingHTTPServer(("127.0.0.1", 0), FakeRelay)
threading.Thread(target=relay.serve_forever, daemon=True).start()
os.environ["B2B_SECURE_DOC_URL"] = "http://127.0.0.1:%d" % relay.server_address[1]
os.environ["B2B_SECURE_DOC_KEY"] = "relay-key"
os.environ.pop("B2B_SECURE_DOC", None)

import secure_doc

# 진짜같은 xlsx(zip) 바이트와, '암호화된 보안문서' 바이트
_zbuf = io.BytesIO()
with zipfile.ZipFile(_zbuf, "w") as zf:
    zf.writestr("sheet1", "data")
PLAIN_XLSX = _zbuf.getvalue()
SECURED = ENC_MAGIC + PLAIN_XLSX          # OLE 머리라 looks_secured 가 잡는다(checker 없이 호출)

work = Path(tempfile.mkdtemp(prefix="secure_doc_test_"))

print("[1] 보안문서로 보이는가(looks_secured) — 확장자가 아니라 내용으로")
check("PK(평문 xlsx)=아니오", secure_doc.looks_secured(PLAIN_XLSX[:8]) is False)
check("OLE+EncryptedPackage=예",
      secure_doc.looks_secured(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", path="x", encrypted_checker=lambda p: True) is True)
check("OLE 구형 xls(bool checker False=평문 확인)=아니오",
      secure_doc.looks_secured(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", name="구형.xls", path="x", encrypted_checker=lambda p: False) is False)
# [제보 2026-08-24 사내 DRM 미인식] 예전 bool checker(EncryptedPackage 유무)는 AIP 만 잡았다 —
# 사내 DRM 의 OLE 래퍼(자체 스트림)는 '구형 xls 평문' 취급으로 조용히 통과해 산출물이 평문으로
# 샜다. 확장자 보정은 안 된다(DRM 이 원본 이름 .xls 를 보존하면 도로 뚫림 — 코드리뷰 지적).
# checker 를 3상(encrypted/plain/unknown)으로: '구형 본문 스트림이 실제로 있는' 파일만 평문,
# 정체불명 구성은 이름과 무관하게 서버에 문의(-200이 최종 판정).
OLE8 = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
check("3상 encrypted=예", secure_doc.looks_secured(OLE8, name="a.xlsx", path="x", encrypted_checker=lambda p: "encrypted") is True)
check("3상 plain(본문 스트림 확인)=아니오 — 위장 .xlsx 라도", secure_doc.looks_secured(OLE8, name="위장.xlsx", path="x", encrypted_checker=lambda p: "plain") is False)
check("3상 unknown(래퍼 의심)=예 — 이름이 구형 .xls 여도", secure_doc.looks_secured(OLE8, name="문서.xls", path="x", encrypted_checker=lambda p: "unknown") is True)
check("checker 예외=예(못 읽으면 서버에 묻는다)",
      secure_doc.looks_secured(OLE8, name="문서.xls", path="x",
                               encrypted_checker=lambda p: (_ for _ in ()).throw(OSError("잠김"))) is True)
check("텍스트(csv)=아니오", secure_doc.looks_secured(b"a,b,c,d,e") is False)
check("한글 텍스트=아니오", secure_doc.looks_secured("이름,금액".encode("cp949")) is False)
check("정체불명 바이너리=예", secure_doc.looks_secured(b"\x8bMIP\x00\x01\x02\x03") is True)

print("[2] 업로드 훅 — 보안문서면 작업본이 평문으로 바뀌고 마커가 남는다")
p = work / "w1_보안문서.xlsx"
p.write_bytes(SECURED)
info = secure_doc.maybe_decrypt_upload(p, "보안문서.xlsx")
check("released=True", bool(info and info.get("released")), info)
check("작업본이 평문으로 교체됨", p.read_bytes() == PLAIN_XLSX)
check("마커 파일 생성", (work / (p.name + ".secured")).exists() or Path(str(p) + ".secured").exists())
check("relay 로 decrypt 호출", GW["calls"][-1]["op"] == "decrypt" and GW["calls"][-1]["key"] == "relay-key",
      GW["calls"][-1])
# [사용자 지시] requestorAccount 기본 = whoami 의 사용자 부분(도메인 접두 없이)
_expected_acct = secure_doc.default_account()
check("requestorAccount=whoami 사용자", bool(_expected_acct) and GW["calls"][-1]["account"] == _expected_acct,
      (GW["calls"][-1]["account"], _expected_acct))
check("도메인 접두 없음", "\\" not in _expected_acct and "/" not in _expected_acct, _expected_acct)
os.environ["B2B_SECURE_DOC_ACCOUNT"] = "manual_acct"
_ = secure_doc.encrypt_for_download(PLAIN_XLSX, "계정확인.xlsx")
check("환경변수로 덮어쓰기", GW["calls"][-1]["account"] == "manual_acct", GW["calls"][-1]["account"])
os.environ.pop("B2B_SECURE_DOC_ACCOUNT")

print("[3] 평문 파일은 건드리지 않는다(릴레이 호출 자체가 없다)")
n = len(GW["calls"])
p2 = work / "w2_plain.xlsx"
p2.write_bytes(PLAIN_XLSX)
info = secure_doc.maybe_decrypt_upload(p2, "plain.xlsx")
check("검사 대상 아님(None)", info is None, info)
check("릴레이 미호출", len(GW["calls"]) == n)
check("파일 그대로", p2.read_bytes() == PLAIN_XLSX)

print("[4] Gateway 가 '대상 아님'(-200)이라면 원본 그대로 + 오류 아님")
weird = work / "w3_unknown.bin"
weird.write_bytes(b"\x00\x01\x02 not drm actually \x00")
info = secure_doc.maybe_decrypt_upload(weird, "unknown.bin")
check("released=False + notDrm", info and info.get("released") is False and info.get("notDrm") is True, info)
check("파일 그대로", weird.read_bytes() == b"\x00\x01\x02 not drm actually \x00")

print("[5] any_secured — 메모리 + 마커 파일 양쪽으로 판단")
check("해제 이력 있음", secure_doc.any_secured(work) is True)
fresh_state = {"releasedIds": set(), "releasedCount": 0, "appliedCount": 0, "lastError": "", "probe": None}
saved = dict(secure_doc._STATE)
secure_doc._STATE.update(fresh_state)          # 백엔드 재시작 흉내(메모리 소실)
check("재시작 후에도 마커로 감지", secure_doc.any_secured(work) is True)
empty = Path(tempfile.mkdtemp(prefix="secure_doc_empty_"))
check("해제 이력 없으면 False", secure_doc.any_secured(empty) is False)
secure_doc._STATE.update(saved)

print("[6] 다운로드 재적용 — 왕복하면 릴레이 규칙대로 암호화본")
out = secure_doc.encrypt_for_download(PLAIN_XLSX, "결과.xlsx")
check("암호화본", out == ENC_MAGIC + PLAIN_XLSX)

print("[7] 릴레이 장애 — 업로드는 계속(경고만), 다운로드는 중단(예외)")
GW["mode"] = "server_down"
p4 = work / "w4_보안문서.xlsx"
p4.write_bytes(SECURED)
info = secure_doc.maybe_decrypt_upload(p4, "보안문서2.xlsx")
check("업로드: released=False + error", info and not info.get("released") and info.get("error"), info)
check("업로드: 작업본은 원본 그대로", p4.read_bytes() == SECURED)
try:
    secure_doc.encrypt_for_download(PLAIN_XLSX, "결과.xlsx")
    check("다운로드: 예외로 중단", False, "예외가 나지 않았다")
except secure_doc.SecureDocError as err:
    check("다운로드: 예외로 중단", True)
    check("오류에 Gateway 메시지", "시스템" in str(err) or "-999" in str(getattr(err, "result", "")), str(err))
GW["mode"] = "ok"

print("[8] serve_b2b 다운로드 훅(_secure_outgoing_data) — 실제 배선으로")
os.environ["B2B_LOG_SYNC"] = "0"               # 테스트 중 로그 전송은 끔
import serve_b2b
serve_b2b.BACKEND_DIR.mkdir(parents=True, exist_ok=True)
marker = serve_b2b.BACKEND_DIR / ("test_" + os.urandom(4).hex() + ".xlsx" + secure_doc.MARKER_SUFFIX)
data, err = serve_b2b._secure_outgoing_data(PLAIN_XLSX, "결과.xlsx", "plain=1")
check("plain=1 은 재적용 건너뜀", err is None and data == PLAIN_XLSX)
try:
    marker.write_text("secured-source", encoding="utf-8")
    data, err = serve_b2b._secure_outgoing_data(PLAIN_XLSX, "결과.xlsx")
    check("보안 이력 있으면 암호화해 내보냄", err is None and data == ENC_MAGIC + PLAIN_XLSX, (err, len(data or b"")))
    GW["mode"] = "server_down"
    data, err = serve_b2b._secure_outgoing_data(PLAIN_XLSX, "결과.xlsx")
    check("재적용 실패 시 다운로드 중단 안내", data is None and err and "보안적용" in err, err)
    GW["mode"] = "ok"
finally:
    try:
        marker.unlink()
    except Exception:
        pass
secure_doc._STATE["releasedIds"].clear()
secure_doc._STATE["releasedCount"] = 0
data, err = serve_b2b._secure_outgoing_data(PLAIN_XLSX, "결과.xlsx")
check("보안 이력 없으면 그대로 통과", err is None and data == PLAIN_XLSX)

print("[9] 기능 끄기 — B2B_SECURE_DOC=0 이면 아무 일도 안 한다")
os.environ["B2B_SECURE_DOC"] = "0"
n = len(GW["calls"])
p5 = work / "w5_보안문서.xlsx"
p5.write_bytes(SECURED)
check("업로드 훅이 None", secure_doc.maybe_decrypt_upload(p5, "x.xlsx") is None)
check("릴레이 미호출", len(GW["calls"]) == n)
st = secure_doc.status(work)
check("status.enabled=False", st["enabled"] is False, st)
os.environ.pop("B2B_SECURE_DOC")

print("[10] 상태 조회(/api/secure-doc/status 가 돌려주는 값)")
p7 = work / "w7_보안문서.xlsx"                 # [8]이 카운터를 0으로 되돌려서, 집계 확인용으로 한 번 더 해제
p7.write_bytes(SECURED)
secure_doc.maybe_decrypt_upload(p7, "x7.xlsx")
st = secure_doc.status(work)
check("enabled/active/anySecured 포함",
      st["enabled"] is True and st["active"] is True and isinstance(st["anySecured"], bool), st)
check("release/apply 횟수 집계", st["releasedCount"] >= 1 and st["appliedCount"] >= 1, st)

print("[11] 서버에 키가 없으면(unconfigured) 조용히 비활성")
GW["configured"] = False
secure_doc._STATE["probe"] = None              # 캐시 비우고 다시 물어보게
check("available=False", secure_doc.available() is False)
p6 = work / "w6_보안문서.xlsx"
p6.write_bytes(SECURED)
info = secure_doc.maybe_decrypt_upload(p6, "x.xlsx")
check("업로드는 경고만 싣고 계속", info and not info.get("released") and "쓸 수 없습니다" in (info.get("error") or ""), info)
GW["configured"] = True
secure_doc._STATE["probe"] = None

print("[12-0] 동시 업로드 — 보안문서 5개를 한꺼번에 풀어도 섞이지 않는다")
# 프론트 업로드 루프는 순차지만, 백엔드는 스레드 서버라 동시 요청이 원리상 가능하다.
# 파일별 내용이 서로 바뀌치기되지 않는지(교차 오염) 5개를 스레드로 동시에 돌려 고정한다.
_files = []
for k in range(5):
    fp = work / ("동시_%d.xlsx" % k)
    fp.write_bytes(ENC_MAGIC + PLAIN_XLSX + ("파일%d" % k).encode("utf-8"))
    _files.append(fp)
_results = [None] * 5
_threads = [threading.Thread(target=lambda i=i: _results.__setitem__(
    i, secure_doc.maybe_decrypt_upload(_files[i], _files[i].name))) for i in range(5)]
for t in _threads:
    t.start()
for t in _threads:
    t.join(timeout=30)
check("5건 모두 해제", all(r and r.get("released") for r in _results), _results)
check("내용이 파일별로 정확(교차 오염 없음)",
      all(_files[k].read_bytes() == PLAIN_XLSX + ("파일%d" % k).encode("utf-8") for k in range(5)))
check("마커 5개", sum(1 for k in range(5) if Path(str(_files[k]) + ".secured").exists()) == 5)

print("[12] 파일명 세탁 — 경로/개행이 multipart 헤더로 새지 않는다")
check("경로 제거", secure_doc._clean_name("..\\..\\evil\r\n.xlsx") == "evil.xlsx" or
      "/" not in secure_doc._clean_name("..\\..\\evil\r\n.xlsx"), secure_doc._clean_name("..\\..\\evil\r\n.xlsx"))
check("개행 제거", "\r" not in secure_doc._clean_name("a\r\nb.xlsx") and "\n" not in secure_doc._clean_name("a\r\nb.xlsx"))

relay.shutdown()
shutil.rmtree(work, ignore_errors=True)
shutil.rmtree(empty, ignore_errors=True)
print("\n" + ("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL"))
sys.exit(1 if fails else 0)

# -*- coding: utf-8 -*-
"""실제 LGU+ MIP Gateway 통합 테스트 — 기본은 SKIP.

허용 IP 로 등록된 서버에서, 명시적으로 켠 경우에만 실제 Gateway 를 부른다:

    RUN_MIP_INTEGRATION_TEST=true python test_drm_integration.py

.env(또는 환경변수)에 MIP_API_KEY / MIP_REQUESTOR_ACCOUNT 가 있어야 한다.
운영 Gateway 로 돌리려면 MIP_GATEWAY_BASE_URL 을 운영 주소로 바꿔서 실행한다.
"""
import io
import os
import sys
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))

if str(os.environ.get("RUN_MIP_INTEGRATION_TEST", "")).strip().lower() != "true":
    print("SKIP: RUN_MIP_INTEGRATION_TEST=true 가 아니어서 실제 Gateway 를 부르지 않습니다.")
    sys.exit(0)

import drm

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails += 1


if not drm.API_KEY:
    print("FAIL: MIP_API_KEY 가 없습니다(.env 확인).")
    sys.exit(1)
if not drm.DEFAULT_ACCOUNT:
    print("FAIL: MIP_REQUESTOR_ACCOUNT 가 없습니다 — 통합 테스트는 등록된 계정이 필요합니다.")
    sys.exit(1)

print(f"[대상] {drm.GATEWAY_BASE_URL}")
client = drm.MIPGatewayClient()

# 진짜 xlsx 모양의 샘플(빈 zip 이 아니라 최소 구조)을 만든다 — Gateway 가 형식을 볼 수 있으므로.
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as zf:
    zf.writestr("[Content_Types].xml", "<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'/>")
SAMPLE = buf.getvalue()
NAME = "axcell_integration_sample.xlsx"
ACCT = drm.DEFAULT_ACCOUNT


def read_stream(value):
    resp, first, headers = value
    data = first
    while True:
        chunk = resp.read(65536)
        if not chunk:
            break
        data += chunk
    resp.close()
    return data


print("[1] drmSecretAPI — 일반 파일 판별")
try:
    result = client.secret(SAMPLE, NAME, ACCT)
    check("응답 result 존재", str(result.get("result", "")) in {"S_DOC", "N_DOC"}, result)
except drm.MIPGatewayError as err:
    check("secret 호출", False, f"{type(err).__name__}: {err}")

print("[2] drmDecryptAPI — 평문이면 -200(복호화 대상 아님)이 정상")
try:
    kind, value = client.decrypt(SAMPLE, NAME, ACCT)
    if kind == "stream":
        read_stream(value)
    check("평문 복호화가 스트림으로 오지는 않아야 함(참고)", kind == "json", kind)
except drm.MIPBusinessError as err:
    check("-200 수신(정상)", err.result == "-200", (err.result, err.result_msg))
except drm.MIPGatewayError as err:
    check("decrypt 호출", False, f"{type(err).__name__}: {err}")

print("[3] drmEncryptAPI → drmDecryptAPI 왕복")
try:
    kind, value = client.encrypt(SAMPLE, NAME, ACCT)
    check("암호화가 스트림으로 온다", kind == "stream", kind)
    enc = read_stream(value) if kind == "stream" else b""
    check("암호화본이 원본과 다르다", bool(enc) and enc != SAMPLE, len(enc))
    if enc:
        kind2, value2 = client.decrypt(enc, NAME, ACCT)
        check("복호화가 스트림으로 온다", kind2 == "stream", kind2)
        dec = read_stream(value2) if kind2 == "stream" else b""
        check("왕복하면 원본", dec == SAMPLE, (len(dec), len(SAMPLE)))
except drm.MIPGatewayError as err:
    check("암/복호화 왕복", False, f"{type(err).__name__}: {err}")

print("[4] drmPolicyAPI — encrypt")
try:
    kind, value = client.policy(SAMPLE, NAME, ACCT, "encrypt")
    if kind == "stream":
        data = read_stream(value)
        check("policy encrypt 스트림", bool(data), len(data))
    else:
        check("policy encrypt 응답", False, value)
except drm.MIPGatewayError as err:
    check("policy 호출", False, f"{type(err).__name__}: {err}")

print("\n" + ("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL"))
sys.exit(1 if fails else 0)

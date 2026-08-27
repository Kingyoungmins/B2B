# -*- coding: utf-8 -*-
"""[보안] 업로드 분기 — 로컬 판정의 구멍과 '어떤 문서든 확인' 설계.

배경(실측 2026-08-27): 보안 문서가 평문으로 통과해 산출물이 무보호로 나갔다. 원인 후보를 파다
보니 looks_secured 가 **앞 4바이트가 PK 면 무조건 평문**으로 통과시키고 있었다. 4바이트는
위조하기 가장 쉬운 값이고, 사고 로그의 그 파일은 실제로 PK 로 시작하면서 zip 으로 안 열렸다.

설계(사용자): 어떤 문서든 게이트웨이에 확인시키고 분기한다. 로컬 판정은 '확실히 평문'을 걸러
왕복을 아끼는 용도로만 남긴다. 게이트웨이를 못 쓰는 동안에는 예전 판단으로 물러난다(업무 정지 방지).

Excel/네트워크 없이 수 초에 끝난다.
"""
import io
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if not cond else ""))
    if not cond:
        fails.append(name)


import secure_doc as sd

work = Path(tempfile.mkdtemp(prefix="secure_route_"))
real_zip = work / "real.xlsx"
with zipfile.ZipFile(real_zip, "w") as z:
    z.writestr("[Content_Types].xml", "<Types/>")
    z.writestr("xl/workbook.xml", "<workbook/>")
fake_zip = work / "fake.xlsx"                       # PK 헤더만 흉내낸 파일
fake_zip.write_bytes(b"PK\x03\x04" + b"\x00" * 400)
truncated = work / "cut.xlsx"                       # 쓰다 만 zip
truncated.write_bytes(real_zip.read_bytes()[:60])

print("[1] PK 헤더만 보고 통과시키던 구멍")
head = b"PK\x03\x04" + b"\x00" * 4
check("진짜 열리는 xlsx 는 평문으로 인정",
      sd.looks_secured(head, "real.xlsx", None, real_zip) is False)
check("헤더만 PK 인 파일은 평문으로 인정하지 않는다",
      sd.looks_secured(head, "fake.xlsx", None, fake_zip) is True, "구멍이 남아 있음")
check("쓰다 만 zip 도 평문으로 인정하지 않는다",
      sd.looks_secured(head, "cut.xlsx", None, truncated) is True)
check("경로를 모르면 예전대로(헤더만 보고 판단)",
      sd.looks_secured(head, "x.xlsx", None, None) is False, "경로 없는 호출까지 막으면 과잉")

print("")
print("[1-2] 사내 DRM 컨테이너(SCDSA) — 원래 유출의 진짜 원인")
# [실측 2026-08-27] 업로드 증거 로그의 magic 이 5343445341303034 = ASCII "SCDSA004" 였다.
# 사내 DRM 은 OLE 도 zip 도 아닌 자체 컨테이너다. 전부 인쇄 가능한 ASCII 라 '제어문자가 있으면
# 바이너리' 규칙에 안 걸렸고, **텍스트로 오인돼 그냥 통과**했다. 서명으로 못 박는다.
scdsa = b"SCDSA004" + b"abcdefgh"
check("SCDSA 서명이면 보안문서로 본다", sd.looks_secured(scdsa, "drm.xlsx", None, None) is True,
      "이 한 줄이 뚫리면 사내 DRM 이 평문으로 샌다")
check("버전이 달라도 접두사로 잡는다",
      sd.looks_secured(b"SCDSA010" + b"xxxxxxxx", "drm.xlsx", None, None) is True)
check("비슷한 이름의 평범한 텍스트는 아니다",
      sd.looks_secured(b"SCDX,name" + b",value\n", "a.csv", None, None) is False)

print("")
print("[2] OLE 는 기존 3상 판정을 유지한다(회귀 방지)")
ole = b"\xd0\xcf\x11\xe0" + b"\x00" * 4
check("암호화로 판정되면 보안문서", sd.looks_secured(ole, "a.xlsx", lambda p: "encrypted", work) is True)
check("구형 xls 로 확인되면 아니다", sd.looks_secured(ole, "a.xls", lambda p: "plain", work) is False)
check("정체불명이면 서버에 물어본다", sd.looks_secured(ole, "a.xlsx", lambda p: "unknown", work) is True)
check("판독 실패도 서버에 물어본다",
      sd.looks_secured(ole, "a.xlsx", lambda p: (_ for _ in ()).throw(OSError("잠김")), work) is True)

print("")
print("[3] 설정 — 평문은 게이트웨이를 찌르지 않는다(기본값)")
# [실측 2026-08-27] 한때 기본을 '어떤 문서든 물어보기' 로 뒀더니, **이미 보안 해제된 평문
# 파일까지 drmSecretAPI / drmDecryptAPI 를 찔렀다**(사용자가 게이트웨이 로그에서 확인).
# 평문에 대고 해제를 부르는 건 확인이 아니라 그냥 시도다. 로컬 판정의 구멍은 [1] 에서 막았다.
cfg = sd.config()
check("alwaysAsk 기본 꺼짐", cfg.get("alwaysAsk") is False, cfg)
check("비밀등급 선행확인 기본 꺼짐(왕복 2회 방지)", cfg.get("secretPrecheck") is False, cfg)
import os
os.environ["B2B_SECURE_DOC_ALWAYS_ASK"] = "1"
check("필요하면 환경변수로 켤 수 있다", sd.config().get("alwaysAsk") is True)
os.environ.pop("B2B_SECURE_DOC_ALWAYS_ASK", None)

calls = []
_saved_post = sd._post_drm


def _spy(op, data, filename, extra_form=None, timeout=None, expect="stream"):
    calls.append(op)
    return b"OUT"


sd._post_drm = _spy
plain_file = work / "plain2.xlsx"
with zipfile.ZipFile(plain_file, "w") as z:
    z.writestr("[Content_Types].xml", "<Types/>")
res = sd.maybe_decrypt_upload(str(plain_file), "plain2.xlsx", None)
check("평문 업로드는 게이트웨이를 한 번도 안 부른다", calls == [], calls)
check("결과도 조용하다(None)", res is None, res)
sd._post_drm = _saved_post

print("")
print("[3-2] 비밀등급은 왕복 한 번으로 안다")
src0 = io.open(ROOT / "secure_doc.py", encoding="utf-8-sig").read()
check("해제 응답의 -200 에서 비밀문서를 가른다", '"비밀문서" in err.result_msg' in src0)
check("그때 secret 플래그를 세운다", "err.secret = True" in src0)
check("사용자에게 이유를 준다", "비밀등급 문서라 보안 해제를 할 수 없습니다" in src0)

print("")
print("[4] 게이트웨이를 못 쓰면 업무를 멈추지 않는다(방화벽 미개방 중)")
src = io.open(ROOT / "secure_doc.py", encoding="utf-8-sig").read()
check("alwaysAsk 는 available() 일 때만 강제한다",
      "cfg.get(\"alwaysAsk\") and available()" in src, "게이트웨이가 닫히면 업무가 멈춘다")
check("물러설 때 이유를 주석으로 남긴다", "업무가 통째로 멈춘다" in src)

print("")
print("[5] 비밀문서(S_DOC)는 해제가 아니라 '거절' 이다")
check("S_DOC 이면 released=False 로 중단", '"secret": True' in src, src[:0])
check("사용자에게 이유를 준다", "비밀등급 문서라 보안 해제를 할 수 없습니다" in src)
check("S_DOC 을 해제 루트로 보내지 않는다", "거절 대상" in src)
check("secret_check 는 실패해도 흐름을 막지 않는다",
      "이 확인이 실패해도 흐름을 막지 않는다" in src)

import shutil
shutil.rmtree(work, ignore_errors=True)
print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

# -*- coding: utf-8 -*-
"""[보안] 원본 라벨 복원 + 결과 통지 — 세 파일(DRM/AIP/평문)을 같이 올렸을 때 무엇이 보이나.

배경(실측 2026-08-27):
  · 되돌릴 때 기본 라벨로 재암호화하면 원본과 다른 보호가 걸린다. 라벨 GUID 는 문서 안
    XrML 에 적혀 있으므로(AUTHENTICATEDDATA id="LABEL") 기억했다가 그대로 복원한다.
  · 'DRM 이냐 AIP 냐' 는 파일로 가릴 수 없다 — 실측한 두 표본이 같은 라벨 GUID 였다.
    그래서 labelid=DRM 강제 같은 추측은 하지 않는다.
  · 평문은 아무 말이 없어서, 세 개를 올리면 알림이 두 개만 떴다("하나는 어떻게 된 거지").
"""
import io
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if not cond else ""))
    if not cond:
        fails.append(name)


import secure_doc as sd

work = Path(tempfile.mkdtemp(prefix="secure_label_"))
LABEL = "9969f62a-31cf-4fe5-9dd4-3a40f493dc7a"
XRML = ('<BODY><AUTHENTICATEDDATA name="ID" id="LABEL">%s</AUTHENTICATEDDATA>'
        '<AUTHENTICATEDDATA name="TenantId" id="LABEL">01622868-7846-4ff6-8e31-fdc8937a8c01'
        '</AUTHENTICATEDDATA></BODY>' % LABEL)

print("[1] 원본 라벨 GUID 를 문서에서 읽는다")
p_ascii = work / "a.bin"
p_ascii.write_bytes(b"\xd0\xcf\x11\xe0" + XRML.encode("ascii") + b"\x00" * 64)
check("ASCII 로 박힌 라벨을 읽는다", sd.read_label_id(p_ascii) == LABEL, sd.read_label_id(p_ascii))
p_wide = work / "b.bin"
p_wide.write_bytes(b"\xd0\xcf\x11\xe0" + XRML.encode("utf-16-le"))
check("UTF-16 으로 박힌 라벨도 읽는다", sd.read_label_id(p_wide) == LABEL, sd.read_label_id(p_wide))
check("바이트로 줘도 된다(평문 교체 전에 읽어야 하므로)",
      sd.read_label_id(XRML.encode("ascii")) == LABEL)
check("라벨이 없으면 빈 문자열", sd.read_label_id(b"PK\x03\x04" + b"\x00" * 40) == "")
check("없는 파일도 조용히 빈 문자열", sd.read_label_id(work / "없음.bin") == "")

print("")
print("[2] 기억했다가 그 라벨로 복원한다")
sd.remember_label("wb1", LABEL)
check("기억한다", sd.recall_label("wb1") == LABEL)
check("모르는 워크북은 빈 값", sd.recall_label("wb-없음") == "")
sd.remember_label("wb2", "")
check("빈 라벨은 기억하지 않는다(엉뚱한 값으로 덮지 않게)", sd.recall_label("wb2") == "")

sent = {}
_saved = sd._post_drm


def _spy(op, data, filename, extra_form=None, timeout=None, expect="stream"):
    sent["op"], sent["form"] = op, dict(extra_form or {})
    return b"OUT"


sd._post_drm = _spy
sd.encrypt_for_download(b"x", "t.xlsx", workbook_id="wb1")
check("복원 때 원본 라벨을 넘긴다", sent["form"].get("labelid") == LABEL, sent)
sent.clear()
sd.encrypt_for_download(b"x", "t.xlsx", workbook_id="모르는것")
check("모르면 labelid 를 안 넘긴다(게이트웨이 기본값)", "labelid" not in sent["form"], sent)
sd._post_drm = _saved

print("")
print("[2-2] 사내 DRM 원본은 사내 DRM 으로 되돌린다(AIP 로 바뀌지 않게)")
# [실측 2026-08-27] SCDSA 컨테이너는 MS RMS 가 아니라 라벨 GUID 가 없다. 그대로 두면
# 되돌릴 때 게이트웨이 기본 라벨(AIP)이 붙어 **보호 방식이 조용히 바뀐다**.
# 규격 2.3 의 labelid=DRM 이 이 경우를 위한 값이고, 서명으로 확실히 아는 경우에만 쓴다.
NUL = b"\x00"
check("SCDSA 원본이면 DRM 으로",
      sd.source_label_for_restore(b"SCDSA004" + NUL * 100) == "DRM")
check("RMS 원본이면 문서의 라벨 GUID 그대로",
      sd.source_label_for_restore(b"\xd0\xcf\x11\xe0" + XRML.encode("ascii")) == LABEL)
check("아무것도 못 읽으면 빈 값(게이트웨이 기본값)",
      sd.source_label_for_restore(b"PK\x03\x04" + NUL * 40) == "")
check("추측하지 않는다 — 서명이 있을 때만 DRM",
      sd.source_label_for_restore(b"SCDX0000" + NUL * 40) != "DRM")

print("")
print("[3] DRM/AIP 를 추측하지 않는다")
src = io.open(ROOT / "secure_doc.py", encoding="utf-8-sig").read()
# 주석에는 "labelid=DRM 은 하지 않는다" 라고 적혀 있으므로, **코드에서 쓰는지**만 본다.
code_only = re.sub(r'"""[\s\S]*?"""|#.*', "", src)
check("서명 확인 없이 DRM 을 강제하지 않는다",
      code_only.count('"DRM"') <= 1 and "VENDOR_DRM_MAGIC" in code_only, code_only[:0])
check("왜 그렇게 판단하는지 근거를 남긴다", "서명으로 원본이 사내 DRM 이었음을 확실히 아는" in src)

print("")
print("[4] 세 파일을 같이 올렸을 때 — 각각 무엇이 보이나")
js = io.open(ROOT / "scripts" / "backend-workbooks.js", encoding="utf-8-sig").read()
check("해제 성공: 해제했다고 알린다", "보안 문서를 해제해 열었습니다" in js)
check("비밀등급: 왜 안 되는지 + 대안을 준다",
      "비밀등급 문서라 처리할 수 없습니다" in js and "등급을 낮춘 사본" in js)
check("게이트웨이 불가: 원본 그대로 열었다고 알린다(공포 유발 금지)",
      "원본 그대로 열었습니다" in js)
check("평문도 결과를 알린다(무소식 금지)", "보안 문서가 아니어서 그대로 열었습니다" in js)
check("서버 오류 원문을 그대로 던지지 않는다", "${data.secure.error}" not in js)

print("")
print("[5] 게이트웨이를 못 쓰는 동안에는 예전대로 연다(업무 정지 금지)")
check("확인 못 했음을 표시만 하고 통과", '"unverified": True' in src)
check("이유를 주석으로 남긴다", "하나는 어떻게 된 거지" in src)

import shutil
shutil.rmtree(work, ignore_errors=True)
print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

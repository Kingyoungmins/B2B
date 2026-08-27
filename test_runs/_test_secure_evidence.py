# -*- coding: utf-8 -*-
"""[보안] 업로드 증거 수집 + 보호 소실 감지 — 원본을 못 꺼내는 환경을 위한 로그 보강.

배경(실측 2026-08-27): 보안 문서가 보안 해제 루트를 건너뛰고 평문으로 다운로드된 사고가 났다.
그런데 로그에는 sniff="other" 한 단어뿐이라 **업로드 당시 그 파일이 보호돼 있었는지조차** 알 수
없었다. 파일을 밖으로 꺼내 확인하려 했지만, 보안망 반출 과정에서 내용이 바뀌어 원본 확인이
불가능했다(사용자 실측). 그러니 증거는 **그 순간 로그에** 남아야 한다.

Excel 없이 수 초에 끝난다(배포 전 일괄 점검용).
"""
import io
import re
import sys
import tempfile
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if not cond else ""))
    if not cond:
        fails.append(name)


# serve_b2b 전체 import 는 무겁다 — 필요한 함수만 떼어 실행한다.
text = io.open(ROOT / "serve_b2b.py", encoding="utf-8-sig").read()
traced = []
ns = {"Path": Path, "zipfile": zipfile, "time": time,
      "_vba_trace": lambda ev, **kw: traced.append((ev, kw))}
for fn in ("_ole_directory_stream_names", "_ole_office_verdict", "is_encrypted_ooxml",
           "_protection_rank", "_check_protection_loss", "_file_label_evidence",
           "_file_label_kind"):
    m = re.search(r"^def %s\(.*?(?=^def |\Z)" % re.escape(fn), text, re.S | re.M)
    if not m:
        print("  FAIL  함수를 찾지 못함: " + fn)
        sys.exit(1)
    exec(m.group(0), ns)

work = Path(tempfile.mkdtemp(prefix="secure_ev_"))


def make_xlsx(path, extra=None):
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("xl/workbook.xml", "<workbook/>")
        for n, b in (extra or {}).items():
            z.writestr(n, b)
    return path


plain = make_xlsx(work / "plain.xlsx")
labeled = make_xlsx(work / "labeled.xlsx", {"docMetadata/LabelInfo.xml": "<x/>"})
# 암호화본(OLE)은 만들기 어렵다 — 앞 8바이트만 OLE 로 흉내내 '판정 실패' 경로를 본다.
fake_ole = work / "fake.bin"
fake_ole.write_bytes(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 500)

print("[1] 증거를 남긴다 — 원본을 못 꺼내도 나중에 판정할 수 있게")
ev = ns["_file_label_evidence"](str(plain))
check("평문 xlsx 를 none 으로", ev["kind"] == "none", ev)
check("크기를 남긴다", ev["bytes"] > 0, ev)
check("앞바이트를 남긴다", ev["magic"].startswith("504B0304"), ev)
check("해시 앞자리를 남긴다", len(ev["sha"]) == 12, ev)
check("컨테이너 내부 이름을 남긴다", "xl/workbook.xml" in ev["inside"], ev)

ev = ns["_file_label_evidence"](str(labeled))
check("라벨만 붙은 파일을 label 로", ev["kind"] == "label", ev)

print("")
print("[2] 판정 실패는 '사유' 를 남긴다 — 예전엔 other 한 단어뿐이었다")
ev = ns["_file_label_evidence"](str(work / "없는파일.xlsx"), tries=1)
check("판정 실패", ev["kind"] == "", ev)
check("사유가 남는다", "FileNotFound" in ev["why"] or "Errno" in ev["why"], ev)
ev = ns["_file_label_evidence"](str(fake_ole), tries=1)
check("깨진 OLE 도 크기·앞바이트는 남는다", ev["magic"].startswith("D0CF11E0") and ev["bytes"] > 0, ev)

print("")
print("[3] 재시도한다 — 쓰기 직후 잠금 때문에 판정이 ''로 빠지면 보안 루트를 건너뛴다")
src = re.search(r"def _file_label_evidence\(.*?\n(?=def )", text, re.S).group(0)
check("tries 인자가 있다", "tries=3" in src, src[:80])
check("재시도 사이에 기다린다", "time.sleep(wait)" in src)

print("")
print("[4] 보호가 약해지면 그 자리에서 크게 남긴다")
traced.clear()
ns["_check_protection_loss"]("테스트", str(labeled), str(plain), name="t.xlsx")
lost = [kw for ev_, kw in traced if ev_ == "secure.protection.lost"]
check("라벨 → 평문 이면 잡아낸다", len(lost) == 1, traced)
if lost:
    k = lost[0]
    check("원본/결과 라벨을 함께", k["srcLabel"] == "label" and k["outLabel"] == "none", k)
    check("양쪽 증거(크기/앞바이트/해시)를 남긴다",
          all(k.get(x) for x in ("srcBytes", "outBytes", "srcMagic", "outMagic", "srcSha12")), k)
    check("사람이 읽을 경고 문구", "보호가 없습니다" in k.get("warn", ""), k)

traced.clear()
ns["_check_protection_loss"]("테스트", str(plain), str(labeled))
check("보호가 강해진 경우는 안 남긴다(잡음 방지)", not traced, traced)
traced.clear()
ns["_check_protection_loss"]("테스트", str(labeled), str(labeled))
check("같으면 안 남긴다", not traced, traced)
traced.clear()
ns["_check_protection_loss"]("테스트", "", str(plain))
check("경로가 비면 조용히 넘어간다", not traced, traced)

print("")
print("[5] 판정 실패를 '평문' 으로 적지 않는다(사고의 핵심)")
up = re.search(r'_sec_payload\["skipped"\].{0,400}', text, re.S).group(0)
check("unknown 과 plain 을 가른다", "unknown-treated-as-plain" in text, up[:200])
check("경고 문구를 함께 남긴다", "보안 루트를 건너뛰었습니다" in text)
check("업로드 증거를 실어 보낸다", '"sha12": _ev.get("sha")' in text or "sha12" in text)

import shutil
shutil.rmtree(work, ignore_errors=True)
print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)

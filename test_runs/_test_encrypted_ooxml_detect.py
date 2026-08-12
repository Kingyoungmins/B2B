# -*- coding: utf-8 -*-
"""[실측] 암호화된 OOXML(사내 MIP 라벨)을 구형 .xls 와 구분하는가.

배경 (적대 검증 2026-08-12)
  처음 구현은 디렉터리를 1섹터만 읽어, 512바이트 섹터 파일에서 엔트리 4개까지만 봤다.
  MIP/IRM 암호화본의 실제 배치는 EncryptedPackage 가 7번째라 **못 찾고** 예전 동작
  (.xls 로 복사해 열기)으로 조용히 되돌아갔다. 실제 사용자 파일 7개 중 6개가 이 오판정이었다.
  → FAT 체인을 따라 디렉터리를 이어 읽는다(상한 32섹터).

이 테스트가 잠그는 것
  1. 512B 섹터에서 EncryptedPackage 가 앞에 있어도, 뒤에 있어도 찾는다
  2. 4096B 섹터도 동일
  3. 구형 .xls 배치는 암호화로 오인하지 않는다(비회귀 — 오인하면 .xls 변환이 사라져 못 연다)
  4. 깨진 파일/무한 체인에도 죽지 않고 False 로 끝난다
"""
import struct
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_src = (ROOT / "serve_b2b.py").read_text(encoding="utf-8-sig")
_i = _src.index("def is_encrypted_ooxml(")
_j = _src.index("\ndef sniff_text_excel_suffix(")
_ns = {}
exec("from pathlib import Path\n" + _src[_i:_j], _ns)
is_encrypted_ooxml = _ns["is_encrypted_ooxml"]

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:160]) if (not cond and detail) else ""))
    if not cond:
        fails += 1


def build_cfb(names, sect_size=512, break_chain=False):
    ents = sect_size // 128
    n_dir = max(1, (len(names) + ents - 1) // ents)
    hdr = bytearray(b"\x00" * 512)
    hdr[0:8] = b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"
    struct.pack_into("<H", hdr, 30, sect_size.bit_length() - 1)
    struct.pack_into("<I", hdr, 44, 1)
    struct.pack_into("<I", hdr, 48, 1)
    struct.pack_into("<I", hdr, 76, 0)
    fat = bytearray(b"\xFF" * sect_size)
    struct.pack_into("<I", fat, 0, 0xFFFFFFFD)
    for k in range(n_dir):
        nxt = 1 if break_chain else ((2 + k) if k + 1 < n_dir else 0xFFFFFFFE)
        struct.pack_into("<I", fat, (1 + k) * 4, nxt)
    dirs = bytearray()
    for k in range(n_dir):
        blk = bytearray(b"\x00" * sect_size)
        for m in range(ents):
            idx = k * ents + m
            if idx >= len(names):
                break
            nm = names[idx].encode("utf-16-le") + b"\x00\x00"
            blk[m * 128:m * 128 + len(nm)] = nm
            struct.pack_into("<H", blk, m * 128 + 64, len(nm))
        dirs += blk
    if sect_size > 512:
        hdr += b"\x00" * (sect_size - 512)
    p = Path(tempfile.mkdtemp()) / "t.xlsx"
    p.write_bytes(bytes(hdr) + bytes(fat) + bytes(dirs))
    return str(p)


MIP = ["Root Entry", "\x06DataSpaces", "DataSpaceMap", "DataSpaceInfo",
       "TransformInfo", "DRMEncryptedTransform", "EncryptedPackage", "EncryptionInfo"]
XLS = ["Root Entry", "Workbook", "\x05SummaryInformation", "\x05DocumentSummaryInformation"]

print("[1] 512바이트 섹터")
check("EncryptedPackage 가 2번째", is_encrypted_ooxml(build_cfb(["Root Entry", "EncryptedPackage"], 512)))
check("MIP 실제 배치(7번째) ← 1섹터만 읽으면 놓치던 케이스", is_encrypted_ooxml(build_cfb(MIP, 512)))

print("[2] 4096바이트 섹터")
check("MIP 배치", is_encrypted_ooxml(build_cfb(MIP, 4096)))

print("[3] 구형 .xls 는 오인하지 않는다(비회귀)")
check("Workbook 스트림 배치", not is_encrypted_ooxml(build_cfb(XLS, 512)))
check("4096B 구형 배치", not is_encrypted_ooxml(build_cfb(XLS, 4096)))

print("[4] 이상한 입력에도 죽지 않는다")
check("체인이 자기 자신을 가리켜도 멈춘다", is_encrypted_ooxml(build_cfb(MIP, 512, break_chain=True)) in (True, False))
_p = Path(tempfile.mkdtemp()) / "zip.xlsx"
_p.write_bytes(b"PK\x03\x04" + b"\x00" * 64)
check("zip(평문 xlsx)은 False", not is_encrypted_ooxml(str(_p)))
_p2 = Path(tempfile.mkdtemp()) / "tiny.xlsx"
_p2.write_bytes(b"\xD0\xCF\x11\xE0")
check("잘린 OLE 도 False", not is_encrypted_ooxml(str(_p2)))
check("없는 파일도 False", not is_encrypted_ooxml(str(Path(tempfile.mkdtemp()) / "nope.xlsx")))

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)

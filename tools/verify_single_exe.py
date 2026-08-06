# -*- coding: utf-8 -*-
"""[빌드 자체검증] 단일 exe 안에 '실행할 본체'가 실제로 들어있는지 확인한다.

왜 필요한가 (실측 2026-08-06)
  단일 exe 는 자기 안에 압축(payload.zip)을 품고 있다가, 실행할 때 임시폴더에 풀고
  그 안의 본체 exe 를 띄운다. 그런데 찾을 이름이 소스에 하드코딩돼 있어서
  버전을 올려 빌드하면 겉은 새 버전인데 속은 옛 이름을 찾다가
      System.IO.FileNotFoundException: Packaged app entry was not found.
  로 실행 자체가 죽었다. **빌드는 성공으로 끝나기 때문에** 사용자가 켜기 전엔 아무도 모른다.
  → 빌드 마지막에 여기서 확인해, 못 켜는 exe 가 배포되는 일을 막는다.

하는 일
  1. 만들어진 exe 안의 payload.zip 을 꺼낸다(리소스로 박혀 있다).
  2. 그 안에 B2B_ver*.exe 가 정확히 하나 있는지 본다.
  3. 그 이름이 지금 버전과 맞는지도 확인한다.
Excel 도, 실행도 하지 않는다(수 초).
"""
import re
import sys
import zipfile
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ENTRY_RE = re.compile(r"^B2B_ver[0-9.]+\.exe$", re.I)


def current_version():
    src = (ROOT / "launch_b2b.py").read_text("utf-8", errors="replace")
    m = re.search(r'^CURRENT_VERSION\s*=\s*["\']([0-9][0-9.]*)["\']', src, re.M)
    return m.group(1) if m else None


def find_payload_zip(exe_path: Path):
    """exe 안에 리소스로 박힌 zip 을 찾는다. zip 은 'PK\\x03\\x04' 로 시작하고
    끝에 중앙 디렉터리(PK\\x05\\x06)가 있다 — 뒤에서부터 찾아 그 구간을 떼어낸다."""
    data = exe_path.read_bytes()
    end = data.rfind(b"PK\x05\x06")
    if end < 0:
        return None
    # EOCD 는 최소 22바이트. 그 뒤 주석 길이까지 포함해 자른다.
    comment_len = int.from_bytes(data[end + 20:end + 22], "little")
    zip_end = end + 22 + comment_len
    start = data.find(b"PK\x03\x04")
    if start < 0 or start >= zip_end:
        return None
    return data[start:zip_end]


def main():
    if len(sys.argv) < 2:
        print("[ERROR] usage: verify_single_exe.py <built exe>")
        return 1
    exe = Path(sys.argv[1])
    if not exe.is_absolute():
        exe = ROOT / exe
    if not exe.exists():
        print(f"[ERROR] built exe not found: {exe}")
        return 1

    blob = find_payload_zip(exe)
    if blob is None:
        print("[ERROR] payload zip not found inside the exe")
        return 1

    tmp = ROOT / "build_meta" / "_verify_payload.zip"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(blob)
    try:
        with zipfile.ZipFile(tmp) as z:
            names = [n for n in z.namelist() if "/" not in n.strip("/")]
    except Exception as err:
        print(f"[ERROR] payload zip is not readable: {err}")
        return 1
    finally:
        try:
            tmp.unlink()
        except Exception:
            pass

    entries = [n for n in names if ENTRY_RE.match(n)]
    if len(entries) != 1:
        print(f"[ERROR] expected exactly one app entry (B2B_ver*.exe), found {len(entries)}: {entries}")
        print(f"        exe files in payload: {[n for n in names if n.lower().endswith('.exe')]}")
        return 1

    entry = entries[0]
    ver = current_version()
    if ver and entry.lower() != f"b2b_ver{ver}.exe".lower():
        print(f"[ERROR] app entry '{entry}' does not match CURRENT_VERSION {ver}")
        return 1

    # [핵심 검사] 진짜 사고는 '압축 내용물'이 아니라 '래퍼가 찾는 이름'에서 났다.
    # 래퍼 소스에 버전이 박힌 exe 이름이 남아 있으면, 그게 payload 의 실제 이름과
    # 같은지 반드시 확인한다(다르면 실행 즉시 죽는다). 이름을 안 박고 패턴으로 찾으면 통과.
    launcher = ROOT / "single_exe" / "B2BSingleExeLauncher.cs"
    if launcher.exists():
        src = launcher.read_text("utf-8", errors="replace")
        # 주석은 제외한다 — 설명글에 옛 이름을 적어둔 것까지 잡으면 헛경보가 난다(실측).
        src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
        src = re.sub(r"//[^\n]*", "", src)
        hardcoded = set(re.findall(r'"(B2B_ver[0-9][0-9.]*\.exe)"', src))
        bad = [h for h in hardcoded if h.lower() != entry.lower()]
        if bad:
            print(f"[ERROR] launcher hardcodes {sorted(bad)} but the packaged entry is '{entry}'")
            print("        -> the built exe would fail at startup with 'Packaged app entry was not found.'")
            return 1
        if hardcoded:
            print(f"[OK] launcher hardcodes {sorted(hardcoded)} (matches packaged entry)")
        else:
            print("[OK] launcher finds the entry by pattern (no hardcoded version)")

    print(f"[OK] packaged entry = {entry} (version {ver})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

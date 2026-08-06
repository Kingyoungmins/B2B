# -*- coding: utf-8 -*-
"""exe 파일 속성(버전 리소스) 생성기 — 빌드 전에 1회 실행.

버전은 launch_b2b.py 의 CURRENT_VERSION 한 곳에서만 읽는다(단일 진실).
여기서 만든 파일을 각 컴파일러가 받아 exe 속성 창에 값을 채운다.

  build_meta/version_server.txt      → PyInstaller (B2B_Server.exe)
  build_meta/AssemblyInfo_host.cs    → csc (네이티브 호스트)
  build_meta/AssemblyInfo_single.cs  → csc (단일 exe)

※ build/ 가 아니라 build_meta/ 인 이유: build_exe.bat 이 중간에 build 폴더를 통째로 지운다.

[포맷 규칙 — 업계 표준 준수, 2026-08-04 확정]
  · 파일 버전   : MAJOR.MINOR.PATCH.BUILD (각 자리 0~65535). 예 0.7.2.0
  · 제품 버전   : 사람이 읽는 버전 문자열. 예 "0.7.2"
  · 파일 설명   : 작업 관리자에 뜨는 이름 → exe 마다 다르게
  · 원본 파일명 : **버전을 넣지 않는 고정 이름**. 이 필드는 "사용자가 파일 이름을 바꿨는지"
                  판단하는 용도라 릴리즈마다 바뀌면 안 된다(chrome.exe / Excel.exe 와 동일 관행).
                  배포 파일명에만 버전을 붙인다.
  · C# 은 OriginalFilename 을 '컴파일 출력 파일명'에서 자동으로 가져간다 → 빌드는 고정 이름으로
    만들고, 배포용 버전 이름은 복사해서 만든다.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build_meta"      # build/ 는 빌드 중 삭제되므로 별도 폴더

COMPANY = "LG Uplus"
PRODUCT = "AX-Cell"
COPYRIGHT = "(c) 2026 LG Uplus"

# exe 별 (파일 설명, 고정 원본 파일명)
TARGETS = {
    "server": ("AX-Cell 백엔드 서버", "B2B_Server.exe"),
    "host":   ("AX-Cell 화면 호스트", "B2B_NativeHost.exe"),
    "single": ("AX-Cell 엑셀 자동화", "AX-Cell.exe"),
}

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def read_version():
    """launch_b2b.py 의 CURRENT_VERSION 을 읽어 (표시용, 4자리) 로 돌려준다."""
    src = (ROOT / "launch_b2b.py").read_text("utf-8", errors="replace")
    m = re.search(r'^CURRENT_VERSION\s*=\s*["\']([0-9][0-9.]*)["\']', src, re.M)
    if not m:
        raise SystemExit("launch_b2b.py 에서 CURRENT_VERSION 을 찾지 못했습니다.")
    shown = m.group(1)
    parts = [int(x) for x in shown.split(".") if x != ""]
    while len(parts) < 4:
        parts.append(0)          # 0.7.2 → 0.7.2.0 (네 번째 자리 = 빌드 번호)
    parts = parts[:4]
    for p in parts:
        if not 0 <= p <= 65535:  # 윈도우 규격: 각 자리 0~65535
            raise SystemExit(f"버전 자리 값이 범위를 벗어났습니다: {shown}")
    return shown, parts


def write_pyinstaller(shown, q):
    """PyInstaller 용 버전 리소스 파일(VSVersionInfo 파이썬 리터럴)."""
    desc, orig = TARGETS["server"]
    txt = f"""# 자동 생성 — tools/gen_version_meta.py (직접 고치지 마세요)
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers={tuple(q)}, prodvers={tuple(q)},
    mask=0x3f, flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)
  ),
  kids=[
    StringFileInfo([
      StringTable('041204B0', [
        StringStruct('CompanyName', '{COMPANY}'),
        StringStruct('FileDescription', '{desc}'),
        StringStruct('FileVersion', '{".".join(map(str, q))}'),
        StringStruct('InternalName', '{Path(orig).stem}'),
        StringStruct('LegalCopyright', '{COPYRIGHT}'),
        StringStruct('OriginalFilename', '{orig}'),
        StringStruct('ProductName', '{PRODUCT}'),
        StringStruct('ProductVersion', '{shown}')
      ])
    ]),
    VarFileInfo([VarStruct('Translation', [1042, 1200])])
  ]
)
"""
    p = BUILD / "version_server.txt"
    p.write_text(txt, "utf-8")
    return p


def write_assemblyinfo(kind, shown, q):
    """C# 용 어셈블리 특성. OriginalFilename 은 출력 파일명에서 자동 결정되므로 여기 없음."""
    desc, orig = TARGETS[kind]
    txt = f"""// 자동 생성 — tools/gen_version_meta.py (직접 고치지 마세요)
using System.Reflection;

[assembly: AssemblyTitle("{desc}")]            // → 파일 설명(작업 관리자 표시)
[assembly: AssemblyProduct("{PRODUCT}")]       // → 제품 이름
[assembly: AssemblyCompany("{COMPANY}")]       // → 회사 이름
[assembly: AssemblyCopyright("{COPYRIGHT}")]   // → 저작권
[assembly: AssemblyVersion("{".".join(map(str, q))}")]
[assembly: AssemblyFileVersion("{".".join(map(str, q))}")]     // → 파일 버전
[assembly: AssemblyInformationalVersion("{shown}")]            // → 제품 버전
"""
    p = BUILD / f"AssemblyInfo_{kind}.cs"
    p.write_text(txt, "utf-8")
    return p


def main():
    BUILD.mkdir(exist_ok=True)
    shown, q = read_version()
    made = [write_pyinstaller(shown, q),
            write_assemblyinfo("host", shown, q),
            write_assemblyinfo("single", shown, q)]
    print(f"[version] 제품 버전 {shown} / 파일 버전 {'.'.join(map(str, q))}")
    for p in made:
        print("  생성:", p.relative_to(ROOT))


if __name__ == "__main__":
    main()

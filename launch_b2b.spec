# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import shutil

ROOT = Path(SPECPATH)
NODE_EXE = shutil.which("node")

def collect(folder: str) -> list:
    # 런타임 자산만 패키징한다. 개발/품질평가 전용 검증 코드(VBA 회귀 러너 · Sonnet 검수 ·
    # 정적체크)는 tests/vba_regression/ 에 있고 spec 은 tests/ 를 수집하지 않는다.
    # 방어선: 혹시 누군가 검증 .py 를 scripts/ 로 되돌려 놓아도 exe 에 들어가지 않도록
    # 아래 패턴을 제외한다. Sonnet 검수는 절대 exe 런타임에 포함되어선 안 된다.
    def _is_dev_only(p):
        if p.suffix != ".py":
            return False
        s = p.stem
        return (s.endswith("_regression_runner")
                or s.endswith("_sonnet_review")
                or s.endswith("_static_checks"))
    return [(str(p), folder)
            for p in (ROOT / folder).iterdir()
            if p.is_file() and not _is_dev_only(p)]

a = Analysis(
    ['launch_b2b.py'],
    pathex=[],
    binaries=[(NODE_EXE, '.')] if NODE_EXE else [],
    datas=[
        ('index.html', '.'),
        ('serve_b2b.py', '.'),
        *collect('styles'),
        *collect('scripts'),
        *collect('vendor'),
    ],
    hiddenimports=[
        'pythoncom',
        'pywintypes',
        'win32timezone',
        'win32com',
        'win32com.client',
        'win32com.client.dynamic',
        'win32con',
        'win32gui',
        'win32process',
        'openpyxl',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='B2B_Server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

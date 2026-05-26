# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import shutil

ROOT = Path(SPECPATH)
NODE_EXE = shutil.which("node")

def collect(folder: str) -> list:
    return [(str(p), folder) for p in (ROOT / folder).iterdir() if p.is_file()]

a = Analysis(
    ['launch_kgm.py'],
    pathex=[],
    binaries=[(NODE_EXE, '.')] if NODE_EXE else [],
    datas=[
        ('index.html', '.'),
        ('serve_kgm.py', '.'),
        *collect('styles'),
        *collect('scripts'),
        *collect('vendor'),
    ],
    hiddenimports=[],
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
    name='KGM_B2B_ver3.7',
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

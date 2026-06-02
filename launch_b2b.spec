# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import shutil

ROOT = Path(SPECPATH)
NODE_EXE = shutil.which("node")

def collect(folder: str) -> list:
    return [(str(p), folder) for p in (ROOT / folder).iterdir() if p.is_file()]

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

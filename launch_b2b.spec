# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import shutil
from PyInstaller.utils.hooks import collect_submodules

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
        # AI 도움 네이티브 팝업 페이지 — 프로즌 서빙 루트(_MEIPASS)에 없으면 /assist.html 이 404
        # (0.6.1.1(구 0.6.1.a) 빌드에서 실측 발견·수정한 것과 동일한 포장 누락)
        ('assist.html', '.'),
        # [사용 가이드 제거] 메뉴에서 뺐으므로 exe 에도 넣지 않는다(파일은 저장소에 남겨 둠).
        ('serve_b2b.py', '.'),
        ('record_service.py', '.'),
        # [로그 자동 전송] 수집 서버로 로그/스킬을 올리는 모듈. 빠지면 배포본에서만 전송이 조용히 꺼진다.
        ('log_sync.py', '.'),
        *collect('styles'),
        *collect('scripts'),
        *collect('vendor'),
        # [앱 아이콘 2026-08-20] 웹 favicon 용 자산(브라우저 모드) — exe 아이콘은 아래 EXE(icon=).
        # assets/ 가 없는 체크아웃에서도 빌드가 깨지지 않게 존재할 때만 수집한다.
        *(collect('assets') if (ROOT / 'assets').is_dir() else []),
    ],
    hiddenimports=[
        'pythoncom',
        'pywintypes',
        'win32timezone',
        'win32com',
        'win32com.client',
        'win32com.client.dynamic',
        # 녹화(WithEvents) — gencache 계열이 없으면 frozen 에서 COM 이벤트 바인딩 실패
        'win32com.client.gencache',
        'win32com.client.build',
        'win32com.client.CLSIDToClass',
        'win32com.client.util',
        'win32con',
        'win32gui',
        'win32process',
        'openpyxl',
        # 녹화 서비스 + 벤더링된 ixi-Cell-R 레코더(지연 import 라 명시)
        'record_service',
        'native_macro_recorder',
        # serve_b2b 가 지연 import 하므로 명시한다(없으면 프로즌에서 import 실패 → 전송 꺼짐).
        'log_sync',
        *collect_submodules('ixicellr'),
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
    # [파일 속성] 버전 리소스 — tools/gen_version_meta.py 가 빌드 직전에 생성한다.
    # 없으면(생성기 미실행) 속성이 비어 있을 뿐 빌드는 그대로 진행된다.
    version=(str(ROOT / 'build_meta' / 'version_server.txt')
             if (ROOT / 'build_meta' / 'version_server.txt').exists() else None),
    # [앱 아이콘 2026-08-20] 아이콘이미지.png 에서 생성한 다중 크기 ICO(assets/axcell.ico).
    # 파일이 없으면 기본 아이콘으로 빌드는 그대로 진행된다.
    icon=(str(ROOT / 'assets' / 'axcell.ico')
          if (ROOT / 'assets' / 'axcell.ico').exists() else None),
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

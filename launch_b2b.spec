# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import shutil
import sys
# [빌드 수정 2026-09-01] 이 PC 패키지 업그레이드 후 분석 임포트 체인이 깊어져 기본 재귀 한도
# (1000, 중첩 ~115단)에서 RecursionError 로 죽었다 — PyInstaller 공식 처방대로 5배 상향.
sys.setrecursionlimit(sys.getrecursionlimit() * 5)
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
        # [관리 대시보드 0.7.5] F9 대시보드 페이지 + 수집서버 프록시. 빠지면 배포본에서만
        # /dashboard.html 404 · /api/logdash 500 이 난다(assist.html 포장 누락과 같은 부류).
        ('dashboard.html', '.'),
        ('log_dash.py', '.'),
        # [로그 자동 전송] 수집 서버로 로그/스킬을 올리는 모듈. 빠지면 배포본에서만 전송이 조용히 꺼진다.
        ('log_sync.py', '.'),
        # [문서보안 0.7.5] 보안문서 해제/재적용 릴레이 클라이언트. 빠지면 배포본에서만 기능이 꺼진다.
        ('secure_doc.py', '.'),
        # [E2E 작업 등록 / 관측 로그 애드온] 스케줄 등록·목록 서버측 + 관측 로그. 빠지면 배포본에서만
        # /api/scheduler/* 가 404 로 죽고 실행 로그가 조용히 꺼진다(log_sync 와 같은 부류).
        ('b2b_scheduler.py', '.'),
        ('b2b_telemetry.py', '.'),
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
        'secure_doc',
        'b2b_scheduler',   # [애드온] serve_b2b 상단에서 import — datas 만으로는 frozen import 가 안 된다
        'b2b_telemetry',
        *collect_submodules('ixicellr'),
        'log_dash',      # [관리 대시보드] datas 만으로는 frozen import 가 안 된다(log_sync 와 동일)
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # [빌드 수정 2026-09-01] 앱은 matplotlib 계열을 전혀 안 쓰는데, 분석기가 (pandas 등의
    # 선택적 import 를 따라) matplotlib 후크를 태우다 아나콘다의 numpy/matplotlib 바이너리
    # 궁합 문제로 빌드가 통째로 죽었다(ImportError: numpy.core.multiarray — 실측).
    # 안 쓰는 걸 명시적으로 제외하면 후크 자체가 안 돌고, exe 도 가벼워진다.
    # pandas 도 제외 — 소스 미사용인데 이 PC 의 pandas 메타데이터가 깨져 있어(dist version=None,
    # 중단된 업그레이드 잔해) hook-pandas 의 버전 검사가 TypeError 로 빌드를 죽였다(실측).
    # nltk/sklearn/PIL 등도 제외 — 전부 소스 미사용인데, 이 PC 의 numpy 가 깨져 있어
    # numpy 에 기대는 후크(hook-nltk→scipy 등)가 로드될 때마다 연쇄로 빌드가 죽었다(실측 3연속).
    excludes=['matplotlib', 'PyQt5', 'PySide2', 'IPython', 'notebook', 'scipy', 'pandas', 'numpy',
              'nltk', 'sklearn', 'PIL', 'torch', 'gensim', 'statsmodels', 'numba', 'sympy',
              # [2026-09-01 실측] 이 PC 에 최근 설치된 LLM/클라우드 SDK 들이 분석 그래프에 휩쓸려
              # (앱 소스는 전혀 import 안 함 — grep 확인) 깨진 transformers import 로 빌드가 죽었다.
              'transformers', 'langchain', 'langchain_core', 'langsmith', 'anthropic', 'openai',
              'sentry_sdk', 'botocore', 'boto3', 'google', 'tensorflow', 'keras', 'jiter',
              'requests_toolbelt', 'tiktoken', 'tokenizers', 'safetensors', 'huggingface_hub'],
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

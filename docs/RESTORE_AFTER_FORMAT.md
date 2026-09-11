# 포맷 후 복구 절차 — 새 PC/포맷한 PC 에서 다시 바이브코딩 시작하기

작성: 2026-09-11 (ver0.8.4 `65baf4c9`, versionTest `7a53ef5`, 교육교안 `52e7051` 기준)

> 코드·문서·테스트는 전부 GitHub `Kingyoungmins/B2B` 의 세 브랜치에 있다. **git 에 없는 것은 아래 0번 목록뿐**이다.

## 0. 포맷 **전에** 챙길 것 (git 에 없음)

| 무엇 | 어디 | 왜 |
|---|---|---|
| `B2B_ver0.8.4/keys.local.json` | `{"_설명": …, "anthropicApiKey": "..."}` | Claude provider 테스트용 키. gitignore. 없으면 F9 개발자 모드에서 Claude 를 못 쓴다(사내 Qwen 은 키 불필요) |
| `versionTest/.env` | `MIP_API_KEY=...` 한 줄 | DRM(문서보안) 해제 연동 키. gitignore |
| `versionTest/logs/` (약 8MB) | 개발 PC 수집 서버가 모은 실제 로그 | 없어도 동작하지만 개발 대시보드가 비어서 시작한다. 실명·마당아이디가 있어 git 금지 |
| `B2B_ver0.8.4/dist/AX-Cell.exe` (= `B2B_ver0.8.4_single.exe`) · `B2B_ver0.8.4_portable.zip` | 배포 산출물(2026-09-10 17:45, SHA256 `43927158…`) | 다시 빌드하면 되지만 그날 배포한 것과 바이트 단위로 같은 파일은 이것뿐 |
| `C:\Users\<계정>\.claude\` | Claude Code 설정 + **프로젝트 메모리**(`projects\c--Users-Admin-Desktop-KGM-git\memory\` 40개) | 메모리는 "이 프로젝트에서 뭘 겪었나"의 요약이다. 폴더째 복사해 두면 그대로 살아난다(경로가 같아야 함 — 아래 2번) |

`시연테스트` 실습 파일과 AI 도움 실기용 스킬 zip(`skill5_회사별요약_5단계.zip`)은 **교육교안 브랜치에 있다** — 따로 챙길 필요 없음.

## 1. 설치

| 도구 | 확인 | 비고 |
|---|---|---|
| Git | `git --version` | |
| Python 3.10+ (이번 PC 는 Anaconda 3.12) | `python -V` | PATH 등록 |
| Node.js (이번 PC 는 v24) | `node -v` | 테스트 러너 + 빌드가 `node.exe` 를 번들한다 |
| Excel (Office) | | 백엔드가 win32com 으로 조작. 없으면 COM 테스트·라이브 미러 불가 |
| C# 컴파일러 | `dir %WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` | Windows 기본 포함. 네이티브 셸 빌드용 |
| VS Code + Claude Code 확장 | | 터미널 `claude` 도 가능 |

파이썬 패키지(둘 다 필요):

```bat
python -m pip install pywin32 openpyxl pyinstaller playwright requests psutil httpx
python -m playwright install chromium
python -m pip install -r versionTest\requirements.txt      :: fastapi uvicorn pydantic python-multipart
```

## 2. 클론 — **같은 경로**로

메모리·테스트 기본값·문서가 `C:\Users\Admin\Desktop\KGM_git\` 를 전제로 한다. 계정명이 바뀌면 메모리 폴더 이름(`c--Users-Admin-Desktop-KGM-git`)도 새 경로로 바꿔 넣으면 된다.

```bat
mkdir C:\Users\Admin\Desktop\KGM_git && cd /d C:\Users\Admin\Desktop\KGM_git
git clone -b ver0.8.4    https://github.com/Kingyoungmins/B2B.git B2B_ver0.8.4
git clone -b versionTest https://github.com/Kingyoungmins/B2B.git versionTest
git clone -b 교육교안     https://github.com/Kingyoungmins/B2B.git 교육교안
```

## 3. 비밀 파일 되돌리기

```text
B2B_ver0.8.4\keys.local.json     ← 백업본 (또는 {"anthropicApiKey": "sk-ant-..."} 로 새로)
versionTest\.env                 ← 백업본 (MIP_API_KEY=...)
versionTest\logs\                ← 백업본(선택)
```

## 4. 돌아가는지 확인 (10분)

```bat
:: 앱 백엔드
cd B2B_ver0.8.4 && python serve_b2b.py            :: http://127.0.0.1:8090  (B2B_PORT 로 변경)
:: 개발용 수집 서버(대시보드 데이터 출처)
cd versionTest && start_log_server.bat             :: 8100. 이미 떠 있으면 재사용하니 코드 바꾸면 재시작!
:: 회귀 테스트 몇 개
node test_runs\_test_org_dashboard.js
python test_runs\_test_dashboard_org_ver_session_e2e.py        :: 브라우저(Playwright) 만 있으면 됨
node test_runs\_test_assist_resolve_file_columns_find.js
python test_runs\_test_assist_empty_final_nudge_e2e.py         :: 백엔드 없으면 스스로 띄움
python tools\okf\check_okf.py                                  :: OKF 최신성
```

전체 일괄: `python tools\issue_recheck\recheck.py` (378개 항목 · COM 테스트는 Excel 필요).

## 5. Claude Code 다시 켜서 첫마디

```
CLAUDE.md 읽고 시작. docs/lessons/MANIFEST.md 와 CHANGELOG.md 의 ver0.8.4 절, docs/RESTORE_AFTER_FORMAT.md 도 봐.
```

- `.claude` 폴더를 되돌렸으면 메모리가 자동으로 붙는다(세션 시작 시 MEMORY.md 인덱스가 로드됨).
- 못 되돌렸어도 `CLAUDE.md`(두 저장소) + `docs/lessons/`(62편) + `CHANGELOG.md` + `tools/issue_recheck/registry.json`(378개 이슈·테스트) 에 같은 내용이 더 자세히 있다.

## 6. 빌드 (배포할 때만)

```bat
cd B2B_ver0.8.4
build_all_single.bat        :: build_exe.bat → build_single_exe.bat, 약 3~4분
:: 결과: dist\B2B_ver0.8.4_single.exe (= dist\AX-Cell.exe), dist\B2B_ver0.8.4_portable.zip
python tools\verify_single_exe.py dist\B2B_ver0.8.4_single.exe
```

자세한 건 `BUILD.md`. 사내 EDR 이 싱글 exe 를 막으면 포터블 zip(`docs/lessons/59`).

## 7. 그 밖에 이 PC 에만 있던 설정 (필요할 때)

- 크롬 원격 데스크톱: 회사 정책 키 `HKLM\SOFTWARE\Policies\Google\Chrome\RemoteAccessHost*` 가 0 이면 서비스가 조용히 죽는다(2026-08-27 해제했었음).
- 개발망 vLLM: `http://192.168.219.108:8000/v1`, key `khkim`, 모델 `Qwen/Qwen3.8-27B-FP8` — 앱 기본값(`scripts/config.js`)에 들어 있다.
- 보안망 수집 서버에 `versionTest/collector.py`(캐시 v6·세션 상세·활성시간) **복사 + 재시작**이 아직 필요하다(2026-09-09 기준 미배포).

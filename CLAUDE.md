# CLAUDE.md — 이 저장소에서 작업할 때 알아야 할 것

> 새로 clone 했다면 이 파일부터 읽으세요. 상세 문서는 `README.md`, 코드 명세는 `docs/okf/`,
> 과거 삽질은 `docs/lessons/` 에 있습니다. **PC 를 포맷했거나 새 PC 라면 `docs/RESTORE_AFTER_FORMAT.md`** 부터.

## 이게 뭔가

LG U+ 사내용 **Excel 자동화 데스크톱 앱**. 사용자가 채팅으로 "회사별 금액 합계를 요약표로
만들어줘" 라고 말하면 그 작업을 **스킬 단계**로 만들어 실제 Excel 에 적용하고, 그 스킬을
다음 달 파일에 그대로 재사용한다.

- 제품명: **B2B 스마트 빌링 에이전트** (2026-09-08 변경, 구 AX-Cell)
  - 예외로 "AX-Cell" 을 유지하는 두 곳: 생성기 U+ 로고 옆 `#page-title`, 좌측 메뉴 그룹 라벨
  - 내부 식별자(`AXCellScheduler`, `axcell.ico`, 빌드 산출물 `AX-Cell.exe`)도 그대로
- 화면 셋: **스킬 생성기**(채팅으로 단계 만들기) / **스킬 실행기**(파일 갈아끼워 전체실행) /
  **관리 대시보드**(`dashboard.html` — 사용 현황)

## 구조 한 장

```
serve_b2b.py        Python 백엔드. HTTP 서버 + Excel COM 제어 + ctx.* 스킬 헬퍼 구현체
                    ※ UTF-8 BOM 파일이다 (launch_b2b.py 도 마찬가지)
index.html          앱 UI 셸
scripts/*.js        프론트엔드
  pipeline.js         스킬 단계 실행/토글/삭제/스냅샷 — 가장 크고 가장 조심할 파일
  chat-ui.js          생성기 채팅(요청 → 단계 생성)
  assist-*.js         AI 도움(F11): core=루프, tools=도구, guard=응답 정제, ui=화면
  excel-mirror.js     라이브 Excel 창 미러링/세션 관리
  file-schema.js      LLM 에게 주는 ctx 함수 설명서(여기 문구가 곧 생성 품질)
  fkey-guard.js       F키 접근 권한 — index.html 의 **첫 번째** 스크립트여야 한다
dashboard.html      관리 대시보드(단일 파일, 백엔드가 서빙)
log_sync.py         실행 로그·스킬을 사내 수집 서버로 전송
log_dash.py         대시보드 → 수집 서버 프록시 (ALLOWED_PATHS 화이트리스트)
native_host/        C# WebView2 셸(창·탭·팝업). 바꾸면 재컴파일 필요
single_exe/         단일 exe 런처(페이로드를 %TEMP% 에 풀어 실행)
test_runs/          테스트. 파일 단독 실행, 성공 시 `RESULT: ALL PASS`
tools/okf/          코드 → 명세 자동 생성기 (`python tools/okf/regen.py`)
tools/issue_recheck/registry.json   고친 이슈 + 그 회귀 테스트 목록
```

## 개발 시작

```bash
python serve_b2b.py          # 기본 포트 8090 (B2B_PORT 로 변경)
# 브라우저에서 http://127.0.0.1:8090/ 열기
```

Excel 이 실제로 설치돼 있어야 한다(win32com 으로 조작). 테스트 상당수도 진짜 Excel 을 띄운다.

## 절대 규칙

1. **API 키는 `keys.local.json` 에만.** 이 파일은 gitignore 돼 있다. 절대 커밋하지 마라.
2. **`serve_b2b.py` · `launch_b2b.py` 는 UTF-8 BOM 유지.** BOM 을 날리면 프로즌 빌드가 깨진다.
   파이썬으로 파싱할 때는 `encoding="utf-8-sig"`.
3. **`.bat` 파일은 CRLF 유지.**
4. **빌드는 사용자가 명시적으로 지시할 때만.** 커밋·푸시는 지시 없이 해도 된다.
5. **고객용 문서는 `.txt` 평문** (`patch_notes/`). 마크다운 기호가 메모장에서 깨지기 때문.
6. **이슈를 고치면 회귀 테스트를 만들고 `tools/issue_recheck/registry.json` 에 등록**한다.
   지금 378개 항목이 있다.

## 작업 습관 (실측으로 굳어진 것)

- **추측하지 말고 로그·실물로 확인한다.** 사용자 제보가 오면
  `%LOCALAPPDATA%\B2B_logs\vba_pipeline_trace.jsonl`(백엔드)와 `runtime_load_trace.jsonl`(클라)
  부터 읽는다. 시각·수치를 먼저 확정한 뒤 코드를 본다.
- **함수만 보고 판단하지 마라.** 그 화면의 버튼 → 엔드포인트 → 실제 구현까지 호출 경로가
  닿는지 확인한다(`docs/lessons/57_*` 이 이 실패의 기록이다).
- **Excel COM 동작은 목(mock)으로 증명되지 않는다.** `test_runs/_test_*_com.py` 처럼
  진짜 Excel 을 띄워 되읽어 확인한다.
- **방어 장치를 함부로 넣지 마라.** 증상만 보고 넣은 가드가 진짜 버그가 된 사례가 있다
  (`docs/lessons/53_*`). 같은 자리를 두 번 패치하게 되면 멈추고 철회를 검토한다.

## 자주 밟는 함정

| 함정 | 내용 |
|---|---|
| 프로즌 stale | "고쳤는데 앱이 그대로" = 배포본이 옛 `B2B_Server.exe` 를 쓰는 중일 수 있다 |
| 수집 서버 재시작 | `versionTest/collector.py` 를 바꿔 복사만 하면 옛 프로세스가 계속 돌아 404. **재시작 필수** |
| 단일 exe 차단 | 사내 EDR(CrowdStrike)이 자동압축해제 exe 를 막는다 → 포터블 zip 으로 배포 (`docs/lessons/59_*`) |
| 스킬 zip 압축 | 재패키징은 `ZIP_STORED` 필수. DEFLATE 면 로더가 거부 |
| heredoc `\n` | bash heredoc 으로 JS/Python 문자열을 쓰면 `\n` 이 실제 줄바꿈이 된다 → Edit 도구로 고칠 것 |

## 연계 저장소 (같은 remote 의 다른 브랜치)

- `versionTest` — 사내 보안망의 버전 확인/로그 수집 서버(FastAPI). 대시보드 데이터의 출처.
- `교육교안` — 실습 교안 HTML + 실습용 xlsx 파일들.

## 문서 어디에 뭐가 있나

| 문서 | 내용 |
|---|---|
| `README.md` | 전체 안내 |
| `docs/okf/` | 코드 자동 명세(함수 단위). `python tools/okf/regen.py` 로 재생성 |
| `docs/lessons/` | 삽질 기록. 새 교훈은 `NN_주제.md` 로 추가하고 `MANIFEST.md` 에 등록 |
| `patch_notes/` | 고객 안내(.txt 평문) |
| `BUILD.md`, `OFFLINE_PORTABLE_BUILD.md` | 빌드 절차 |
| `CHANGELOG.md` | 개발자용 변경 이력 |

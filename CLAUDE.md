# CLAUDE.md — 이 저장소에서 작업할 때 알아야 할 것

> 새로 clone 했다면 이 파일부터. 상세는 `README.md`, API 는 `docs/API.md`,
> 배포 절차는 `docs/DEPLOY.md`, 과거 삽질은 `docs/LESSONS.md`.

## 이게 뭔가

LG U+ **사내 보안망에 두는 파이썬 서버**. 데스크톱 앱
"B2B 스마트 빌링 에이전트"(구 AX-Cell, 같은 remote 의 `ver0.8.4` 브랜치)가 여기로 두 가지를 보낸다.

1. **버전 확인** — "이 버전 써도 되나요?" (앱 시작 시 1회)
2. **로그·스킬 업로드** — 실행 중 남은 트레이스와 사용자가 만든 스킬 zip

관리자는 앱에 내장된 대시보드(`dashboard.html`)로 이 서버의 `/v1/admin/*` 를
앱의 프록시(`log_dash.py`)를 거쳐 조회한다.

## 파일

```
main.py         버전 확인 API(허용 목록 방식) + 앱 라우터 등록
collector.py    로그·스킬 수집 + 관리 대시보드용 집계 API  ← 대부분의 작업이 여기
drm.py          문서보안(DRM) 해제 연동
start_log_server.bat   기동 스크립트 (※ 이미 떠 있으면 재사용한다 — 아래 함정 참고)
test_*.py       테스트. 각각 단독 실행, 성공 시 `RESULT: ALL PASS`
logs/           수집된 실제 로그 — .gitignore 됨(사내 사용자 실명·조직 정보)
.env            MIP_API_KEY — .gitignore 됨
```

## 실행

```bash
pip install -r requirements.txt
python main.py --version-file version.txt --log-root <로그폴더> --host 0.0.0.0 --port 8100
# 또는 start_log_server.bat
```

테스트: `python test_active_time.py` 처럼 파일을 그냥 실행한다.

## 절대 규칙

1. **`logs/` 와 `.env` 는 절대 커밋하지 마라.** logs 에는 사내 직원 실명·마당아이디·조직 경로가
   들어 있고 .env 에는 API 키가 있다. `.gitignore` 에 이미 있으니 지우지 마라.
2. **집계 규칙을 바꾸면 세션 캐시 버전 `"v"` 를 올려라.** `.agg_cache` 에 세션별 집계가
   저장되는데, 버전을 안 올리면 옛 값이 계속 서빙된다.
   이력: v2 = 토큰 / v3 = 전체실행 / v4 = 활성시간 / **v5 = 자리비움 기준 10분(현재)**
3. **하위 호환.** 구버전 앱이 보낸 세션에는 새 필드(조직·토큰·telemetry)가 없다.
   항상 "없을 수 있다" 를 전제로 짜고, 없으면 빈 값으로 내보내 대시보드가 `-` 로 그리게 한다.

## 가장 자주 밟는 함정 — 배포하고 재시작을 안 한다

`collector.py` / `main.py` 를 보안망에 **복사만 하고 서버를 재시작하지 않으면**
옛 프로세스가 계속 돌아 새 API 가 404 난다. `start_log_server.bat` 이 이미 떠 있는 서버를
재사용하기 때문이다.

실측(2026-09-03): 대시보드의 "상세를 불러오지 못했습니다" 원인이 정확히 이것이었고,
프로세스를 죽이고 재시작하니 즉시 200 OK.

또 하나: **여러 줄 `version.txt` 를 쓰려면 `main.py` 를 먼저(또는 동시에) 올려야 한다.**
구버전 `main.py` 는 첫 줄만 읽어서 엉뚱한 버전과 비교한다.

배포 순서는 `docs/DEPLOY.md` 참고.

## 주요 기능 (언제 무엇이 들어왔는지)

| 기능 | 요약 |
|---|---|
| 버전 허용 목록 | `version.txt` 가 여러 줄이면 허용 목록. `version` 응답은 목록의 최댓값(구버전 앱 호환) |
| 조직 정보 | 앱이 보낸 `extra.org` → 이름·마당아이디·팀·조직경로. `admin_sessions` 의 `org=` 필터 |
| LLM 토큰 집계 | `llm.usage` 트레이스 → `admin_events.tokens`(모델별·사용자별·일별), 세션 행에도 |
| 전체실행 집계 | `telemetry_preview.jsonl` 의 `event_type=="agent.run"` → `fullRuns` |
| 끊김 추정 | `lastSeenAt` 600초 무소식 → `stale=true`(대시보드 "종료(추정)") |
| 세션 상세 | `/v1/admin/session/detail` — 로그 파일 목록 + 스킬 zip 의 단계 수·제목. `session/file` 로 개별 다운로드(경로 탈출 차단) |
| 활성 시간 | 로그 ts 간격이 **10분** 이하면 실사용으로 합산(`_ACTIVE_GAP_SECONDS=600`) |

## 앱 쪽과 맞물리는 지점

- 앱의 `log_sync.py` 가 여기로 보낸다. 보내는 파일 목록은 앱 쪽 `extra_files` 에 있다.
- 대시보드는 앱의 `log_dash.py` 프록시를 거친다. **새 엔드포인트를 만들면 그쪽
  `ALLOWED_PATHS` 화이트리스트에도 추가**해야 대시보드에서 호출된다.

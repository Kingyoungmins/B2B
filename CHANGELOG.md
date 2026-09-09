# 변경 이력

이 서버(버전 확인 · 로그 수집 · 문서보안 중계)의 날짜별 변경 기록입니다.
각 항목 뒤의 한 줄은 **왜 그렇게 했는지**입니다.

저장소 커밋은 2026-09-09 최초 커밋 하나뿐이라, 아래 날짜는 코드에 남은 날짜 표기
(`[… 2026-09-02]` 같은 주석)와 테스트 파일의 기록을 근거로 정리했습니다.

---

## 2026-09-09

- **문서 정비** — `README.md` 전면 최신화, `CHANGELOG.md` · `docs/API.md` ·
  `docs/DEPLOY.md` · `docs/LESSONS.md` 신규.
  → README 가 2026-08-24 기준에 멈춰 있어 최근 2주간 늘어난 기능(허용 목록·조직·토큰·
  전체실행·활성시간·세션 상세)이 통째로 빠져 있었다. 포맷 후 `git clone` 만으로 개발을
  이어갈 수 있게 한다.
- **테스트 실측 기록** — `test_dashboard_api.py` 가 오늘 날짜에서 5건 실패하고,
  `test_dashboard_api.py` · `test_admin_events.py` 는 한국어 Windows 콘솔에서
  `UnicodeEncodeError` 로 죽는다는 것을 확인해 문서에 적었다(코드는 손대지 않음).
  → 원인은 서버가 아니라 테스트 쪽(날짜 고정 + 콘솔 인코딩 미지정)이다.
  자세한 내용은 `docs/LESSONS.md`.

## 2026-09-08

- **활성 시간 추정 추가** (`_ACTIVE_GAP_SECONDS = 600`, `_scan_session_events`)
  → "누가 얼마나 실제로 썼나"를 알고 싶은데, 세션 체류 시간(`dwellMinutes`)은 켜 두고
  자리를 비운 시간까지 포함해 과대집계였다. 앱을 고치지 않고 서버가 이미 파싱하는
  세션 로그의 `ts` 간격으로 근사한다 — 간격이 **10분 이하일 때만** 사용 시간으로 합산하고,
  넘으면 자리비움으로 보아 0 으로 센다.
- 노출 위치: `agg["activeMinutes"]`, `/admin/sessions` 각 행의 `activeMinutes`,
  `/admin/events` 의 `active{minutes, byUser, byDate}`.
- **자리비움 기준 5분 → 10분** 으로 조정(지시). 이때 **집계 캐시 버전 `v4` → `v5`**.
  → 기준이 바뀌면 이미 저장된 캐시 값이 틀린 값이 된다. `v` 를 올려야 재계산된다.
- 테스트: `test_active_time.py`(간격 합산 + 캐시 히트).

## 2026-09-03

- **세션 상세 API** `GET /admin/session/detail` 신규
  → 실행 목록에 로그·스킬 '개수'만 보여서, 그 실행이 무엇을 했는지 알려면 zip 을 받아
  풀어 봐야 했다. 이제 로그 파일 목록(이름·크기)과 스킬 zip 의 단계 수·켜진 단계 수·
  단계 제목(최대 40개)까지 바로 보여준다. 스킬 zip 안 `*.logic.json` 을 열어 읽는다.
  깨진 zip 은 그 행의 `error` 필드로만 표시하고 나머지는 정상 나열한다(하나 때문에
  상세 전체가 실패하지 않게).
- **개별 파일 다운로드** `GET /admin/session/file?kind=logs|skills&name=...` 신규
  → 스킬 zip 하나만 보고 싶을 때 세션 전체 zip 을 받는 것은 낭비다. 이름은
  `safe_filename` 으로 세탁하고 부모 디렉터리까지 확인해 `../` 경로 탈출을 막는다.
- **전체실행 집계** `fullRuns{count, ok, error, totalMs, avgMs, byUser}` 추가.
  집계 캐시 **`v3`**.
  → 전체실행 성공/실패와 소요를 알 방법이 없었다. `telemetry_preview.jsonl` 의 레코드는
  `event` 대신 `event_type` 을 쓰므로, `event` 가 없고 `event_type == "agent.run"` 인
  레코드를 따로 센다(`status == "success"` → ok, `latency_ms` → 소요).
- **세션별 토큰** — `/admin/sessions` 각 행에 `tokens{total, prompt, completion, calls}` 추가.
  → 총량만 보이면 "누가 많이 썼나"를 알 수 없다. 이벤트 집계 캐시를 그대로 재사용하므로
  목록 조회가 무거워지지 않는다.
- **토큰 일별 추이** `tokens.byDate` 추가.
  → 대시보드에 추세 그래프를 그리려면 날짜별 합이 필요하다.
- 테스트: `test_session_detail.py`, `test_token_stats.py`.

## 2026-09-02

- **버전 허용 목록** (`main.py` `read_version_file`)
  → 배포가 단계적으로 이뤄져 사내에 여러 버전이 동시에 돌고, "최신 하나만 통과" 규칙으로는
  멀쩡한 버전까지 교체 안내가 떴다. 이제 `version.txt` 가 여러 줄이면 그 버전들이 전부
  허용이다. 응답의 `allowed` 가 목록 전부이고, `version`/`normalized` 는 그중 최신 —
  **구버전 앱은 `version` 하나만 보므로** 이 호환 필드가 필요하다.
- **`--download-url` / `AXCELL_DOWNLOAD_URL`** 추가 → 응답 `downloadUrl`.
  → 앱의 "다운로드 하러가기" 버튼이 열 주소를 서버가 정할 수 있어야, 배포 위치가 바뀌어도
  앱을 다시 만들지 않는다.
- **조직 정보** — 앱이 `whoami /fqdn` 파싱 결과를 `session/start` 의 `extra.org` 로 보낸다.
  서버는 그대로 저장하고 `/admin/sessions` 에 `displayName`, `madangId`, `team`, `orgPath`
  로 노출한다. `org=` 파라미터로 `team`·`orgPath` 부분일치 필터.
  → 사용자 폴더명(윈도우 계정)만으로는 누구인지·어느 팀인지 알 수 없어 팀별 사용 현황을
  낼 수 없었다. 구버전 앱 세션은 `extra.org` 가 없어 **빈 문자열**로 나가고 대시보드가
  `-` 로 그린다.
- **끊김 세션 추정** `_session_is_stale` (`_STALE_AFTER_SECONDS = 600`)
  → 대시보드에 거의 모든 세션이 "수집 중"으로 고착됐다. 앱 X 종료 시 호스트가 응답 직후
  서버를 kill 해 `session/end` 가 유실되는 레이스였다(앱 쪽에서 응답 전 전송으로 수정).
  이미 쌓인 것과 앞으로도 생길 신호 유실(크래시·전원 꺼짐)은 서버가 흡수한다 —
  마지막 수신이 10분 넘게 없으면 `stale:true`, `stats.openSessions` 에서도 제외.
- **LLM 토큰 집계** `tokens{prompt, completion, total, calls, byModel}`.
  집계 캐시 **`v2`**.
  → 앱 프록시가 `llm.usage` 트레이스를 남기고 있는데 아무 API 도 읽지 않았다. 세션 스캔에서
  같이 집계하면 추가 비용이 거의 없다.
- 테스트: `test_version_allowlist.py`, `test_org_in_admin.py`, `test_stale_sessions.py`.

## 2026-08-31

- **이벤트 전량 집계** `GET /admin/events` 신규 — `byEvent`, `durations`,
  `steps{byLanguage, byStepIdx}`, `errorsByDate`, `scanned`.
  → 단계별 소요(`ms`)·언어·`stepIdx` 가 트레이스에 이미 있는데 어떤 API 도 읽어 주지 않았다.
- **오류 집계를 전량 스캔으로** — 예전에는 파일 끝 256KB 만 봤다.
  → 큰 세션의 앞부분 오류가 통째로 빠져 '오류율' 지표로 쓸 수 없었다. 또 `limit` 을 정렬
  **후** 자르도록 바꿨다 — 먼저 찾은 것부터 자르면 최신 오류가 빠질 수 있었다.
- **세션 집계 캐시** `<log-root>/.agg_cache/<날짜>/<사용자>/<세션>.json` 도입.
  → 전량 파싱은 폴더가 커질수록 무겁다. 닫힌 세션의 로그는 다시 바뀌지 않으므로 세션당
  한 번만 읽고 결과를 캐시한다. `sig`(로그 `*.jsonl` 의 이름:크기:mtime)로 검증하고,
  `.tmp` 로 쓴 뒤 원자적으로 교체한다. 폴더 이름이 날짜 형식이 아니라서 세션 순회에 안 잡히고
  세션 zip 에도 섞이지 않는다.
- 테스트: `test_admin_events.py`.

## 2026-08-27

- **시작 점검·진단을 서버 기동 뒤 백그라운드로** 이동(`start_background_checks`, 5초 지연).
  → 게이트웨이가 막힌 상태에서 TLS 시도마다 제한시간을 다 쓰느라 90초 넘게 포트가 안 열렸고,
  그동안 플랫폼 헬스체크(`GET /v1/models`)가 실패해 **파드가 계속 재시작**됐다. 진단하려다
  서비스를 죽인 셈이다 — 점검은 아무리 유용해도 서비스보다 뒤다.
- 사이드카(Envoy) 통계 읽기 상한을 300KB → 넉넉히 확대.
  → `/stats`·`/clusters` 응답이 잘려 정작 필요한 줄이 안 보였다.
- 테스트: `test_startup_selfcheck.py`.

## 2026-08-26

- **문서보안 폐쇄망 진단 도구 일습** — 시작 자가진단(`startup_selfcheck`), 단계별 프로브
  (이름 풀이 → TCP → TLS → HTTP), Envoy 카운터 확인, `--ask` / `ask.txt` 질문 창구,
  심층 진단 자동 저장(`<log-root>/_diagnostics/`), DNS 실패 시 등록된 VIP 로 직접 연결.
  → 폐쇄망은 파일 한 번 올리는 것도 큰 일이고 사용자에게는 터미널 하나뿐이다. 문제가 보이면
  묻지 않고 한 번에 다 찍고, 재시작 없이 다시 물어볼 수 있어야 한다.
- 오류 분류 세분화 — `-100` 인증 / `-200` 업무 / `-999` 서버 / 네트워크·타임아웃을 구분하고,
  RST(Errno 104)를 일반 네트워크 오류와 섞지 않는다.
  → "timeout" 으로 뭉뚱그리면 방화벽이 **끊은** 것과 응답이 **늦은** 것을 구분할 수 없다.

## 2026-08-24 (문서상 최초 기준)

> 버전 확인 기능 자체는 이보다 앞섭니다 — `test_version_service.py` 의 파일 날짜가
> 2026-08-04 이고 `command.txt` 에도 "2026-08-04 배포" 메모가 있습니다. 아래는 로그 수집·
> 대시보드·문서보안이 함께 갖춰진 시점(옛 README 기준일)으로 묶은 것입니다.

- **버전 확인 서버** — `GET /version`, `/version/check?v=`, `/health`, `/v1/models`
  (전사 표준 프로브라 항상 200), 그리고 모든 경로의 `/v1` 별칭.
  → 앱은 기존 AI 설정의 로컬 `/v1` 프록시를 그대로 재사용해 나오므로, `/v1` 별칭이 없으면
  게이트웨이를 못 지난다. 요청이 올 때마다 `version.txt` 를 다시 읽어 재시작이 필요 없다.
  읽을 파일 경로는 켤 때의 인자로만 정한다 — 요청으로 받으면 임의 파일 읽기가 된다.
- **로그·스킬 수집** — `POST /logs/session/start`, `/logs/append`(offset 기반 재전송 안전),
  `/logs/file`, `/logs/session/end`, `GET /logs/health`.
  `날짜 → 사용자 → 세션` 폴더에 `session.json` · `logs/` · `skills/` 로 쌓는다.
  → 사용자 PC 로그는 앱을 다시 켤 때 비워져서, 제보를 받고 요청하면 이미 지워진 뒤였다.
  '한 번 켠 것 = 폴더 하나' 라서 로그와 스킬셋이 항상 짝으로 남는다. 시작 요청이 유실돼도
  받은 자료는 `recovered` 폴더를 만들어 살린다 — '받은 건 일단 남긴다'.
- **경로 세탁**(`safe_part`, `safe_filename`) — 사용자·세션·파일명 전부 화이트리스트.
  → 빼먹으면 `../..` 로 서버 아무 곳에나 파일을 쓸 수 있다. 테스트로 고정.
- **관리자 조회** — `GET /admin`(HTML 목록), `/admin/sessions`, `/admin/dates`,
  `/admin/session.zip`, `/admin/day.zip`.
- **대시보드 집계 API** — `GET /admin/stats`(일별·사용자별 세션/용량/스킬/로그/체류/열린 세션),
  `GET /admin/errors`.
  → 앱의 F9 대시보드는 보안망 폴더를 직접 못 본다(게이트웨이 분리). 화면이 바로 그릴 수 있는
  모양으로 서버가 계산해 준다. 체류 시간은 `endedAt` 이 없으면 `lastSeenAt` 으로 물러난다 —
  종료를 못 남기고 죽는 세션이 많아 `endedAt` 만 믿으면 대부분 0 분이 된다.
- **문서보안 중계** — `POST /api/drm/{encrypt,decrypt,secret,policy}`, `GET /api/drm/health`
  (+ `/v1/drm/*` 별칭). 기본 Gateway 는 **운영**.
  → 사용자 PC 는 허용 IP 제한으로 MIP Gateway 를 직접 못 부른다.
- **부가 기능은 없어도 죽지 않게** — `collector.py`·`drm.py` import 실패 시 경고만 찍고
  버전 확인은 계속 돈다.
- 테스트: `test_version_service.py`, `test_log_collector.py`, `test_dashboard_api.py`,
  `test_drm_service.py`, `test_drm_integration.py`(기본 SKIP).

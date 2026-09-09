# 버전 확인 · 로그 수집 서버 (versionTest)

LG U+ **보안망**에 떠 있는 파이썬 서버입니다. 데스크톱 앱 **B2B 스마트 빌링 에이전트**
(구 AX-Cell, 폴더 `B2B_ver0.8.4`)가 이 서버에 물어보고, 이 서버에 자료를 보냅니다.

하는 일은 셋입니다.

1. **버전 확인** — `version.txt` 에 적힌 **허용 버전 목록**을 알려줍니다. 앱은 자기 버전이
   목록에 없으면 "최신 버전으로 교체해 주세요" 안내를 띄웁니다. (`main.py`)
2. **로그·스킬 수집 + 관리 집계** — 앱이 실행 중에 보내오는 로그와 자동백업 스킬 zip 을
   `날짜 → 사용자 → 실행(세션)` 폴더에 쌓고, 관리 대시보드가 바로 그릴 수 있는 모양으로
   집계해 돌려줍니다. (`collector.py` ← 이 저장소의 핵심)
3. **문서보안(DRM) 중계** — 앱이 보낸 보안문서를 MIP Gateway 로 풀거나 걸어 돌려줍니다.
   (`drm.py`)

```
사용자 PC (B2B 앱)                     보안망 (이 서버)
  버전 확인 ─────┐
  로그/스킬 전송 ─┼─→ 로컬 /v1 프록시 ─→ 게이트웨이 ─→ main.py + collector.py + drm.py
  대시보드(F9) ──┘                                       └ /data/public/versionTest/logs
```

관리자는 앱에 내장된 **F9 관리 대시보드**(`dashboard.html`)로 봅니다. 화면은 앱의 로컬
백엔드가 서빙하고, 데이터는 앱의 프록시(`log_dash.py`)가 게이트웨이 인증을 붙여 이 서버의
`/v1/admin/*` 로 중계합니다. (브라우저 주소창은 커스텀 헤더를 못 붙여서 게이트웨이를 못 지나기
때문입니다 — 그래서 대시보드 URL 을 직접 열 수 없습니다)

| 파일 | 하는 일 |
|---|---|
| `main.py` | 버전 확인 API, 앱(FastAPI) 조립, 시작 자가진단, 명령줄 옵션 |
| `collector.py` | 로그/스킬 수집 + 관리 대시보드용 집계 API **(핵심)** |
| `drm.py` | 문서보안(MIP Gateway) 중계 + 폐쇄망 네트워크 진단 |
| `test_*.py` | 계약 테스트. 전부 `python test_xxx.py` 단독 실행, `RESULT: ALL PASS` 출력 |
| `command.txt` | 운영 서버 설치·실행 러너북(설치/서비스 등록/방화벽/끄기) |
| `start_log_server.bat` | **개발 PC** 용 원클릭 실행(내 PC 로 로그를 받아 본다) |
| `docs/API.md` | 엔드포인트 상세 명세(필드 하나하나) |
| `docs/DEPLOY.md` | 보안망 수동 배포 체크리스트 |
| `docs/LESSONS.md` | 실측 교훈(배포 순서 함정, 캐시 버전 규칙 등) |

이 서버와 **짝이 되는 앱 쪽 파일**(저장소가 다릅니다 — 폴더 `B2B_ver0.8.4`)

| 앱 쪽 파일 | 이 서버의 무엇과 짝인가 |
|---|---|
| `log_sync.py` | 수집 API 로 로그·스킬을 올리는 쪽. 세션 시작/append/파일/종료, `extra.org` 를 만든다 |
| `log_dash.py` | 대시보드용 프록시. `/api/logdash/<경로>` → `<이 서버>/v1/admin/<경로>` |
| `dashboard.html` | F9 관리 대시보드 화면(집계 결과를 그린다) |
| `scripts/version-gate.js` + `serve_b2b.py` 의 `version_gate_status` | 시작 시 1회 `GET /v1/version` 으로 허용 목록 대조, 교체 안내 팝업 |

---

## 설치

```bash
pip install -r requirements.txt
```

필요한 것: `fastapi>=0.109`, `uvicorn[standard]>=0.27`, `pydantic>=2.6`, `python-multipart>=0.0.7`.
파이썬은 **3.10 이상**을 쓰세요 — `command.txt` 에는 3.9 이상으로 적혀 있지만, 지금 코드는
pydantic 모델 필드에 `int | None` 표기를 써서 3.10 이상이 안전합니다.
(개발 PC 실측 조합: Python 3.12.7 + fastapi 0.109.0 + pydantic 2.5.3 에서 테스트 전부 통과)

사내망에서 pip 이 막히면 저장소를 지정합니다.

```bash
python -m pip install -r requirements.txt --index-url http://사내저장소/simple --trusted-host 사내저장소
```

## 실행

```bash
# 운영(보안망) — 로그 수집까지
python3 main.py --version-file /data/public/versionTest/version.txt \
                --log-root     /data/public/versionTest/logs \
                --download-url "http://다운로드주소/B2B_설치.zip" \
                --host 0.0.0.0 --port 8100
```

```bat
:: 개발 PC — 두 번 클릭 (앱이 내 PC 로 로그를 보내도록 환경변수까지 설정)
start_log_server.bat
:: 원래대로(사내 서버로) 되돌리기
start_log_server.bat off
```

| 옵션 | 뜻 | 기본값 |
|---|---|---|
| `--version-file` | 허용 버전이 적힌 파일 경로 **(필수)** | 없음 |
| `--download-url` | 앱의 "다운로드 하러가기" 가 열 주소 (env `AXCELL_DOWNLOAD_URL`) | 없음 |
| `--host` | 바인딩 주소 | `0.0.0.0` |
| `--port` | 포트 | `8100` |
| `--log-root` | 수집 자료를 쌓을 폴더(없으면 만듭니다) | `/data/public/versionTest/logs` |
| `--no-collector` | 수집을 끄고 버전 확인만 함 | 꺼짐 |
| `--retention-days` | 이 일수보다 오래된 **날짜 폴더** 삭제 | `0` = 안 지움 |
| `--max-session-mb` | 한 실행(세션)당 받을 최대 용량 MB | `300` |
| `--ingest-key` | 수집 인증 키(앱이 `X-B2B-Log-Key` 로 보냄, env `AXCELL_LOG_INGEST_KEY`) | 없음(인증 없음) |
| `--admin-key` | 관리 조회 키(`?key=` 또는 `X-Admin-Key`, env `AXCELL_LOG_ADMIN_KEY`) | 없음(인증 없음) |
| `--mip-*` | 문서보안 설정(아래 [문서보안] 참고) | `.env` |
| `--diagnose` / `--no-diagnose` / `--diagnose-only` | 폐쇄망 네트워크 심층 진단 제어 | 문제 있을 때만 자동 |
| `--ask "질문"` | 서버를 띄우지 않고 진단 한 줄만 답하고 끝냄 | — |

동작 메모

- **`version.txt` 만 고치면 됩니다 — 서버 재시작 불필요.** 요청이 올 때마다 다시 읽습니다.
  단, **`main.py`/`collector.py` 를 고쳤으면 반드시 재시작**해야 합니다([docs/DEPLOY.md](docs/DEPLOY.md)).
- `--log-root` 를 못 만들면(권한 등) 서버가 죽지 않고 `main.py` 옆 `logs` 로 물러나며, 어디에
  쌓는지 시작 로그에 찍습니다.
- `collector.py` / `drm.py` 를 못 읽어도 **버전 확인은 계속 돕니다**(경고만 찍고 그 기능만 꺼짐).
- 시작 점검·진단은 **서버가 뜬 뒤 5초 후 백그라운드**에서 돕니다. 기동을 막으면 플랫폼
  헬스체크(`GET /v1/models`)가 실패해 파드가 재시작되기 때문입니다.

---

## version.txt — 허용 버전 목록

한 줄에 버전 하나. **여러 줄이면 그 버전들이 전부 허용**입니다. `#` 으로 시작하는 줄과 빈 줄은
무시합니다.

```
# B2B 허용 버전 목록 - 한 줄에 하나씩, 여기 적힌 버전만 통과
0.8.2
0.8.3
0.8.4
```

- 형식은 숫자와 점만 (`0.8.4`, `0.8.4.0`, 최대 4자리). `v0.8.4` 처럼 앞에 `v` 를 붙여도 됩니다.
- `0.8.4` 는 `0.8.4.0` 으로 **4자리로 맞춰** 비교합니다(문자열 비교로 생기는 불일치 방지).
- 응답의 `allowed` 가 목록 전부, `version`/`normalized` 는 그중 **가장 큰 버전**입니다.
  구버전 앱은 `version` 하나만 보고 비교하므로 이 호환 규칙이 필요합니다.
- 한 줄만 적으면 예전(단일 비교)과 완전히 같습니다.
- 목록이 비었거나 버전 형식이 아니면 `ok:false` + `error` 로 알려줍니다(서버는 안 죽습니다).

**앱은 `allowed` 안에 자기 버전이 없으면 교체 안내 팝업을 띄웁니다.** 그래서 새 버전을 배포하면
version.txt 에 그 버전을 **추가**하고, 더 못 쓰게 할 버전은 **줄을 지우면** 됩니다.

### 앱은 이 응답을 어떻게 쓰나 (앱 쪽 `version_gate_status` / `scripts/version-gate.js`)

앱은 켤 때 **한 번만** 자기 백엔드의 `/api/app/version/gate` 를 부르고, 그 백엔드가 이 서버의
**`GET /v1/version`** 을 `Api-Key` 헤더와 **3초 제한**으로 호출합니다. `allowed` 가 없는
구버전 서버 응답이면 `[normalized 또는 version]` 한 개짜리 목록으로 취급합니다.

| 서버 응답 상태 | 앱 화면 |
|---|---|
| 내 버전이 `allowed` 안에 있음 | 팝업 없음(통과) |
| 내 버전이 `allowed` 에 없음 | "오래된 버전을 사용하고 있습니다. 최신 버전으로 교체 해주세요." + **[다운로드 하러가기]** (`[무시하고 사용하기]` 는 팝업 중 `F2` 를 눌러야 보임) |
| 서버 주소는 있는데 응답을 못 받음(오류·3초 초과·`ok:false`) | **"점검중입니다. 문의사항이 있으시면 팀즈로 문의 부탁드립니다"** + [확인] |
| 서버 주소 자체가 없음(개발 PC 등) | 팝업 없음(조용히 통과) |

- 팝업은 **실행당 한 번**만 뜹니다(F5·다중 탭에도 반복 안 함).
- 다운로드 주소 우선순위: 앱에 저장된 주소 → 서버가 준 `downloadUrl` → 앱 기본값.
  즉 `--download-url` 은 앱을 다시 만들지 않고 배포 위치를 바꾸는 수단입니다.
- **운영 주의**: 서버를 재시작하는 동안 앱을 켠 사용자는 "점검중입니다" 팝업을 봅니다.
  재시작은 짧게, 가능하면 사용이 적은 시간에 하세요.

---

## 쌓이는 모양 (폴더 구조)

**한 번 켠 것 = 폴더 하나.** 그 실행의 로그와 그 실행에서 만들어진 스킬이 항상 짝으로 남습니다.

```
/data/public/versionTest/logs/            ← --log-root
  2026-09-09/                             ← 날짜 (YYYY-MM-DD, 서버 기준)
    kgm_hong/                             ← 사용자 (whoami 결과, \ 와 / 는 _ 로 세탁)
      20260909-091530-13244-a1b2/         ← 실행 1회 = 세션
        session.json                      누가/어느 PC/어느 버전/언제 켜고 껐는지 + 파일 목록
        logs/                             vba_pipeline_trace.jsonl, telemetry_preview.jsonl,
                                          runtime_load_trace.jsonl, vba_runner_fail.log …
        skills/                           그 실행 중 만들어진 자동백업 스킬 zip
  .agg_cache/                             집계 캐시 (아래 [집계 캐시] 참고)
  _diagnostics/                           심층 진단 결과 txt (drm)
  ask.txt / ask_result.txt                진단 질문/답 (서버가 도는 중에도 물어보는 창구)
```

- 앱은 `%LOCALAPPDATA%\B2B_logs` 의 `*.jsonl`, `*.log` 중 **늘어난 부분만** 기본 30초마다
  올립니다(`start_log_server.bat` 은 10초로 설정). 앱 쪽 사용자 PC 로그는 앱을 다시 켤 때
  비워지지만, **서버로 보낸 것은 남습니다** — 이 서버를 만든 이유입니다.
- 전송이 실패하면 다음 주기에 이어서 보냅니다. 서버는 이미 받은 만큼을 잘라내므로 같은 줄이
  두 번 들어가지 않습니다(offset 기준).
- `session.json` 의 주요 필드: `sessionId, user, userRaw, host, appVersion, pid, os, appDir,
  logDir, skillDir, startedAt, serverStartedAt, date, closed, endedAt, endReason, totalBytes,
  files{}, extra{}, lastSeenAt`. 상황에 따라 `reconnects, capped, recovered, note,
  serverEndedAt` 이 붙습니다.
- 폴더/파일 이름은 전부 화이트리스트로 세탁합니다(한글·영숫자·`. _ -`·공백만 허용).
  `../..` 같은 경로 탈출은 차단되고 그것을 고정하는 테스트가 있습니다.

### 조직 정보 (2026-09-02 추가)

앱이 `whoami /fqdn` 을 파싱한 결과를 `POST /v1/logs/session/start` 의 `extra.org` 로 보냅니다.
서버는 그대로 `session.json` 에 저장하고, 세션 요약과 조직 필터에 씁니다.

| 필드 | 예 |
|---|---|
| `displayName` | 서영민 (이름) |
| `madangId` | s0min (마당 아이디) |
| `team` | Foundation리서치팀 |
| `orgPath` | LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀 |

- 도메인에 물리지 않은 PC(개발 등)와 **구버전 앱**은 `extra.org` 가 없습니다 → 서버는 **빈
  문자열**로 내보내고 대시보드는 `-` 로 그립니다. 새 필드는 항상 없을 수 있다고 보고 짜세요.
- `GET /v1/admin/sessions?org=CTO` 처럼 `org=` 로 거르면 `team` 과 `orgPath` **전체**에서
  부분일치(대소문자 무시)로 찾습니다. 팀명은 물론 센터/Lab 이름으로도 걸립니다.

---

## API 레퍼런스

모든 경로에 **`/v1` 별칭**이 있습니다(`/logs/health` = `/v1/logs/health`). 앱은 기존 AI 설정의
로컬 `/v1` 프록시를 그대로 재사용해 나오기 때문에, `/v1` 이 없으면 게이트웨이를 못 지납니다.
필드 하나하나까지의 상세 명세는 **[docs/API.md](docs/API.md)** 에 있습니다.

### 버전 확인 (main.py)

| 주소 | 하는 일 |
|---|---|
| `GET /v1/models` | **전사 표준 프로브 — 항상 200 OK** (모델은 제공하지 않으므로 빈 목록) |
| `GET /health` · `/v1/health` | 서버 살아있는지 + version.txt 경로 |
| `GET /version` · `/v1/version` | 허용 목록 + 최신 버전 |
| `GET /version/check?v=0.8.3` · `/v1/version/check?v=` | 보내준 버전이 허용 목록 안인지 |
| `GET /docs` | FastAPI 자동 문서(브라우저에서 바로 테스트) |

```json
// GET /v1/version   (version.txt 에 0.8.2 / 0.8.3 / 0.8.4)
{
  "ok": true,
  "version": "0.8.4.0",
  "normalized": "0.8.4.0",
  "allowed": ["0.8.2.0", "0.8.3.0", "0.8.4.0"],
  "downloadUrl": "http://다운로드주소/B2B_설치.zip",
  "source": "/data/public/versionTest/version.txt",
  "updatedAt": "2026-09-03T06:35:12+00:00",
  "error": null
}

// GET /v1/version/check?v=0.8.1
{ "ok": true, "version": "0.8.4.0", "allowed": ["0.8.2.0","0.8.3.0","0.8.4.0"],
  "client": "0.8.1.0", "match": false }     // ← false 면 앱이 교체 안내를 띄운다
```

`/v1/models` 는 version.txt 를 못 읽는 상태여도 **200 을 유지**합니다. 여기서 500 을 내면
"서비스 자체가 죽은 것"으로 오인돼 상위 점검이 전부 실패로 잡히기 때문입니다.

### 수집 (앱이 부른다, collector.py)

인증: `--ingest-key` 를 정했을 때만 `X-B2B-Log-Key` 헤더 필요(기본 없음).

| 주소 | 하는 일 |
|---|---|
| `POST /v1/logs/session/start` | 이번 실행의 폴더 만들기(같은 세션 재요청이면 재사용 + `reconnects`) |
| `POST /v1/logs/append` | 로그의 늘어난 부분 이어붙이기(`offset` 기준, 재전송 안전) |
| `POST /v1/logs/file` | 스킬 zip 등 통째 파일 올리기(같은 이름·같은 크기면 `duplicate`) |
| `POST /v1/logs/session/end` | 이 실행 끝 표시 |
| `GET /v1/logs/health` | 수집기 상태·저장 위치·최근 날짜 7개 |

본문은 base64(기본은 gzip 압축 후 base64)로 보냅니다. 상한: 조각 하나 12MB(base64 문자 길이),
압축 푼 크기 32MB, 세션 총합 `--max-session-mb`(기본 300MB, 넘으면 `capped:true` 로 더 안 받음).

### 관리 조회 (대시보드가 부른다, collector.py)

인증: `--admin-key` 를 정했을 때만 `?key=...` 또는 `X-Admin-Key` 헤더 필요(기본 없음).

| 주소 | 하는 일 | 주요 파라미터 |
|---|---|---|
| `GET /v1/admin/sessions` | 실행 목록 + 조직·토큰·활성시간 | `date`, `user`, `org`, `limit`(1~2000, 기본 200) |
| `GET /v1/admin/dates` | 날짜별 사용자·세션 수 | — |
| `GET /v1/admin/stats` | 기간·사용자별 집계(세션/용량/체류/열린 세션) | `from`, `to`, `user` |
| `GET /v1/admin/events` | 이벤트 전량 집계(토큰·전체실행·활성시간·단계·오류추이) | `from`, `to`, `user` |
| `GET /v1/admin/errors` | 오류 이벤트만 최신순 | `from`, `to`, `user`, `limit`(1~1000, 기본 200) |
| `GET /v1/admin/session/detail` | 그 실행의 로그 파일 목록 + 스킬 단계 | `user`, `session` (필수), `date` |
| `GET /v1/admin/session/file` | 세션 폴더 안 파일 하나 내려받기 | `user`, `session`, `kind=logs\|skills`, `name` |
| `GET /v1/admin/session.zip` | 세션 폴더 통째 zip | `date`, `user`, `session` (전부 필수) |
| `GET /v1/admin/day.zip` | 하루치(또는 그날 한 사용자) 통째 zip | `date` (필수), `user` |
| `GET /admin` | zip 을 클릭으로 받는 최소 HTML 목록 | `date`, `user` |

zip 한 번에 512MB 를 넘으면 413 으로 거절합니다(날짜/사용자를 좁혀 주세요).

#### 실행 목록 — `GET /v1/admin/sessions`

```json
{
  "ok": true, "root": "/data/public/versionTest/logs", "count": 1,
  "sessions": [{
    "date": "2026-09-09", "user": "kgm_hong", "sessionId": "20260909-091530-13244-a1b2",
    "displayName": "서영민", "madangId": "s0min", "team": "Foundation리서치팀",
    "orgPath": "LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀",
    "appVersion": "0.8.4.0", "host": "VM-01",
    "startedAt": "2026-09-09T09:15:30", "endedAt": "", "closed": false,
    "stale": true,                       // 10분 넘게 무소식 → 대시보드가 "종료(추정)" 으로 표시
    "endReason": "", "recovered": false, "capped": false,
    "lastSeenAt": "2026-09-09T09:41:02",
    "logFiles": ["vba_pipeline_trace.jsonl"], "skillFiles": ["스킬_3단계.zip"],
    "sizeBytes": 831488, "sizeKb": 812.0,
    "path": "/data/public/versionTest/logs/2026-09-09/kgm_hong/20260909-091530-13244-a1b2",
    "zipUrl": "/admin/session.zip?date=2026-09-09&user=kgm_hong&session=...",
    "tokens": { "total": 128400, "prompt": 119000, "completion": 9400, "calls": 37 },
    "activeMinutes": 22.5
  }]
}
```

- **`stale` (끊김 추정, 2026-09-02)** — 앱이 강제 종료·크래시·전원 꺼짐으로 죽으면 종료 신호가
  안 와서 `closed` 가 영영 `false` 입니다. 그래서 마지막 수신(`lastSeenAt`)이 **600초(10분)**
  넘게 없으면 `stale:true` 를 줍니다. 클라 전송 주기가 10~30초이므로 10분은 넉넉한 배수입니다.
  `/admin/stats` 의 `openSessions` 에서도 stale 세션은 빼서 셉니다.
- `tokens`, `activeMinutes` 는 아래 이벤트 집계 **캐시를 그대로 재사용**하므로 목록 조회가
  무거워지지 않습니다. 집계에 실패하면 `null` 로 나가고 대시보드는 `-` 로 그립니다.

#### 이벤트 집계 — `GET /v1/admin/events`

세션 로그(`logs/*.jsonl`)를 **전량** 파싱해 만든 숫자들입니다. 대시보드 '분석' 탭의 원천.

```json
{
  "ok": true,
  "scanned": { "sessions": 120, "cached": 118, "files": 480, "bytes": 91234567, "skippedBytes": 0 },
  "byEvent":   [ { "event": "pipeline.step.ok", "count": 8123 } ],
  "durations": [ { "event": "fullrun.step.ok", "count": 812, "avgMs": 1430.2, "maxMs": 91002.0, "totalMs": 1161322.4 } ],
  "active":    { "minutes": 4210.5,
                 "byUser": [ { "user": "kgm_hong", "minutes": 320.4 } ],
                 "byDate": [ { "date": "2026-09-08", "minutes": 512.0 } ] },
  "tokens":    { "prompt": 9120000, "completion": 480000, "total": 9600000, "calls": 3120,
                 "byModel": [ { "model": "gpt-4o", "prompt": 0, "completion": 0, "total": 0, "calls": 0 } ],
                 "byUser":  [ { "user": "kgm_hong", "prompt": 0, "completion": 0, "total": 0, "calls": 0 } ],
                 "byDate":  [ { "date": "2026-09-08", "prompt": 0, "completion": 0, "total": 0, "calls": 0 } ] },
  "fullRuns":  { "count": 210, "ok": 190, "error": 20, "totalMs": 4200000, "avgMs": 20000.0,
                 "byUser": [ { "user": "kgm_hong", "count": 12, "ok": 11, "error": 1 } ] },
  "steps":     { "byLanguage": [ { "language": "vba", "runs": 900, "ok": 870, "error": 30, "avgMs": 1200.5 } ],
                 "byStepIdx":  [ { "stepIdx": 0, "runs": 210, "error": 4 } ] },
  "errorsByDate": [ { "date": "2026-09-08", "count": 17 } ]
}
```

무엇을 어디서 뽑는지(추측 아님 — 코드가 읽는 필드입니다):

| 집계 | 원천 | 읽는 필드 |
|---|---|---|
| **LLM 토큰** (2026-09-02, `byDate` 는 09-03) | `event == "llm.usage"` (앱 프록시가 남긴 트레이스) | `promptTokens`, `completionTokens`, `totalTokens`(없으면 앞의 둘을 더함), `model` |
| **전체실행** (2026-09-03) | `event` 가 **없고** `event_type == "agent.run"` (`telemetry_preview.jsonl`) | `status == "success"` → ok, 아니면 error / `latency_ms` |
| **활성 시간** (2026-09-08) | 모든 레코드의 `ts`(또는 `timestamp`) | 정렬 후 인접 간격이 **600초 이하일 때만** 합산 |
| **소요시간** | `ms`(없으면 `totalMs`)가 있는 모든 이벤트 | 이벤트별 count/avg/max/total |
| **단계 실행** | `fullrun.step.ok\|error`, `pipeline.step.ok\|error` | `language`, `stepIdx`(0~499), `ms` |
| **오류** | 이벤트 이름에 `.error .fail .failed runtime_error save_error recover` 가 들어간 것 (`recovered`, `recover.ok` 는 제외) | `error`/`message`/`cause` 앞 200자, `stepIdx`, `stepId` |

**활성 시간(activeMinutes)의 뜻** — 로그 이벤트 간격의 근사치입니다. 간격이 10분 이하면 계속
쓰는 중으로 보고 합산하고, 10분을 넘으면 자리비움으로 보아 0 으로 셉니다. 이벤트가 안 찍히는
'읽기만 하는' 시간은 자리비움으로 잡힙니다 — 과대집계보다 과소집계가 낫다고 보고 이렇게 했습니다.
(처음에는 5분이었고 2026-09-08 지시로 10분이 되었습니다)

#### 세션 상세 — `GET /v1/admin/session/detail` (2026-09-03)

대시보드에서 실행 목록의 한 줄을 펼칠 때 부릅니다. 스킬 zip 안의 `*.logic.json` 을 열어 단계 수·
켜진 단계 수·단계 제목(최대 40개)까지 보여줍니다.

```json
{
  "ok": true, "date": "2026-09-09", "user": "kgm_hong", "sessionId": "20260909-091530-13244-a1b2",
  "logs":   [ { "name": "vba_pipeline_trace.jsonl", "sizeKb": 812.0 } ],
  "skills": [ { "name": "월마감_정리.zip", "sizeKb": 24.5, "steps": 7, "enabledSteps": 6,
                "stepTitles": ["1. 원본 시트 정리", "2. 헤더 찾기", "3. 합계 (꺼짐)"] },
              { "name": "깨진스킬.zip", "sizeKb": 0.1, "steps": null, "enabledSteps": null,
                "stepTitles": [], "error": "스킬 파일을 읽지 못했습니다: ..." } ]
}
```

**깨진 zip 은 그 행의 `error` 로만 표시하고 나머지는 정상 나열합니다** — 하나가 깨져서 상세
전체가 실패하면 안 되기 때문입니다.

`GET /v1/admin/session/file?...&kind=skills&name=월마감_정리.zip` 로 파일 하나만 받을 수 있습니다.
이름은 세탁(`safe_filename`) 후 **그 폴더 안**에 실제로 있는지, 부모 디렉터리가 정확히
`<세션>/logs` 또는 `<세션>/skills` 인지까지 확인합니다 — `../` 경로 탈출 차단.

---

## 집계 캐시 (.agg_cache) — 규칙 하나만 기억하세요

로그 전량 파싱은 폴더가 커질수록 무겁습니다. 그래서 **세션당 한 번만 읽고 결과를 파일로
캐시**합니다. 닫힌 세션의 로그는 다시 바뀌지 않으므로 캐시가 계속 유효합니다.

```
<log-root>/.agg_cache/<날짜>/<사용자>/<세션ID>.json
  { "sig": "vba_pipeline_trace.jsonl:831488:1757390000|...", "v": 5, "agg": { ... } }
```

- `sig` = 그 세션 `logs/*.jsonl` 의 `이름:크기:mtime` 목록. 하나라도 바뀌면 다시 스캔합니다.
- 캐시 폴더 이름은 날짜 형식(`YYYY-MM-DD`)이 아니라서 세션 순회에 잡히지 않고, 세션 zip 에도
  섞이지 않습니다.
- 쓸 때는 `.tmp` 로 쓰고 원자적으로 교체합니다(동시 요청이 반쪽 캐시를 읽지 않게).

> ### ⚠ 집계 규칙을 바꾸면 반드시 `v` 를 올리세요 (`collector.py` `_session_events`)
> 지금 `v` 는 **5** 입니다. `v` 를 그대로 두고 계산식만 바꾸면 **옛 캐시가 그대로 서빙되어**
> 화면 숫자가 안 바뀝니다. 지금까지의 이력: `v2` 토큰 → `v3` 전체실행 → `v4` 활성시간 →
> `v5` 자리비움 기준 5분→10분.
>
> 급하면 `<log-root>/.agg_cache` 폴더를 지워도 됩니다(다음 조회 때 다시 만듭니다).

캐시 무효화는 `*.jsonl` 의 이름·크기·수정시각만 봅니다. `*.log`(예: `vba_runner_fail.log`)만
바뀐 경우에는 재스캔하지 않습니다 — 집계 대상이 `*.jsonl` 뿐이라 결과가 같기 때문입니다.

---

## 테스트

전부 네트워크·Excel 없이 수 초에 끝납니다. `RESULT: ALL PASS` 가 나오면 정상입니다.

```bash
python test_version_service.py      # 버전 확인 기본(임의 파일 읽기 차단 포함)
python test_version_allowlist.py    # version.txt 허용 목록 + downloadUrl
python test_log_collector.py        # 수집 계약(경로 탈출 차단·중복 제거·상한)
python test_admin_events.py         # /admin/events 집계 + 오류 전량 스캔 + 캐시 위치
python test_org_in_admin.py         # extra.org 저장·노출·org= 필터·구버전 호환
python test_stale_sessions.py       # 끊김(종료 추정) 판정 — 10분
python test_token_stats.py          # llm.usage 토큰 집계
python test_session_detail.py       # 세션 상세(스킬 단계) + 파일 하나 다운로드
python test_active_time.py          # 활성 시간(간격 근사) + 캐시 히트
python test_startup_selfcheck.py    # 시작 자가진단(서비스가 점검보다 먼저)
python test_drm_service.py          # 문서보안 — 가짜 Gateway 를 띄워 검증
python test_dashboard_api.py        # /admin/stats · /admin/errors  (주의: 아래 참고)
RUN_MIP_INTEGRATION_TEST=true python test_drm_integration.py   # 실제 Gateway(허용 IP 서버에서만)
```

주의 두 가지 (실측 2026-09-09)

1. **`test_dashboard_api.py` 와 `test_admin_events.py` 는 콘솔 인코딩을 직접 맞추지 않습니다.**
   한국어 Windows 기본 콘솔(cp949)에서는 `—` 를 못 찍어 `UnicodeEncodeError` 로 죽습니다.
   `PYTHONIOENCODING=utf-8` 을 주고 돌리세요(다른 테스트는 파일 안에서 스스로 맞춥니다).
   ```bat
   set PYTHONIOENCODING=utf-8
   python test_dashboard_api.py
   ```
2. **`test_dashboard_api.py` 는 2026-08-24 에만 통과합니다(현재 5 FAIL).** 세션을 만들 때
   `date:"2026-08-24"` 를 보내는데 `POST /logs/session/start` 에는 `date` 항목이 **없어서**
   무시되고, 폴더는 늘 **서버의 오늘 날짜**로 만들어집니다. 이어서 `append`(이건 `date` 를
   봅니다)가 `2026-08-24` 폴더를 못 찾아 `recovered` 폴더를 하나 더 만들기 때문에 세션이 2개가
   아니라 4개로 집계됩니다. 테스트의 시간 고정 문제이고 서버 동작은 정상입니다
   ([docs/LESSONS.md](docs/LESSONS.md) 참고).

---

## 보안망 배포

파일을 복사한 다음 **서버를 반드시 재시작**해야 합니다. 자세한 순서와 검증 명령은
**[docs/DEPLOY.md](docs/DEPLOY.md)** 에 있습니다. 요약만:

1. `main.py` · `collector.py` 를 보안망 `/data/public/versionTest/` 에 덮어쓴다.
   (여러 줄 `version.txt` 를 쓰려면 `main.py` 를 **먼저 또는 같이** 올린다)
2. 돌던 프로세스를 **중지**한다 (`systemctl stop` 또는 포트로 찾아 kill).
3. 다시 켠다. 시작 로그에 저장 위치·보관 정책이 찍히는지 본다.
4. `curl http://127.0.0.1:8100/v1/logs/health` → `{"ok":true, ...}`
5. 새로 추가한 API 를 직접 한 번 부른다(예: `/v1/admin/session/detail`). **404 면 옛 프로세스가
   아직 도는 것**입니다.

> 파일만 복사하고 재시작을 안 해서 새 API 가 404 나는 일이 실제로 있었습니다
> (2026-09-03, 대시보드 "상세를 불러오지 못했습니다"). 가장 흔한 함정입니다.

---

## 문제 해결

| 증상 | 먼저 볼 것 |
|---|---|
| 대시보드가 "상세를 불러오지 못했습니다" / 새 항목이 안 보임 | **서버 재시작을 했는지.** 새 API 는 프로세스를 다시 띄워야 생깁니다 |
| 화면 숫자가 코드를 고쳤는데 안 바뀜 | 집계 캐시 `v` 를 올렸는지. 아니면 `<log-root>/.agg_cache` 삭제 |
| 앱이 최신인데 교체 안내가 뜸 | `version.txt` 에 그 버전 줄이 있는지. `curl "…/v1/version/check?v=0.8.4"` 로 `match` 확인 |
| 구버전 `main.py` + 여러 줄 `version.txt` | 구버전은 **첫 줄만** 읽어 엉뚱한 비교를 합니다. `main.py` 를 올리세요 |
| 아무것도 안 쌓인다 | `curl …/v1/logs/health` 의 `ok`. false 면 `--log-root` 권한. 앱 쪽은 로컬 백엔드의 `/api/log-sync/status`(기본 `http://127.0.0.1:18090`, 포트가 밀리면 18091…) |
| 특정 PC 만 안 올라온다 | 그 PC 에서 이 서버로 못 나가는 경우(방화벽/프록시) |
| 세션이 계속 "수집 중" | 종료 신호 유실입니다. 10분 지나면 `stale:true` → "종료(추정)" 으로 바뀝니다 |
| 팀/이름이 `-` 로 보인다 | 구버전 앱이거나 도메인에 안 물린 PC(`extra.org` 없음). 정상 동작입니다 |
| 세션 용량이 멈췄다 | `session.json` 의 `capped:true`. `--max-session-mb` 초과 |
| `recovered:true` 세션이 많다 | `session/start` 가 유실된 것. 자료는 살립니다만 반복되면 조사 대상 |
| 포트가 이미 사용 중 | `--port 8101` 로 띄우거나 기존 프로세스를 끄세요 |
| 수집을 끄고 싶다 | 서버는 `--no-collector`, 특정 PC 만이면 그 PC 환경변수 `B2B_LOG_SYNC=0` |

로그/개인정보 주의: `logs/` 에는 사내 사용자의 **실명·마당아이디·조직 경로**가 들어 있습니다.
`.gitignore` 에 `logs/` 가 있는 이유이며 **절대 커밋하지 마세요**. `.env`(MIP 키)도 같습니다.

---

# 문서보안 (DRM MIP Gateway)

## 왜 있나

사용자 PC 는 LG U+ MIP Gateway 를 직접 부를 수 없습니다(허용 IP 제한). 이 서버는 사내망에서
항상 떠 있으므로, 앱이 보안문서(AIP/DRM)를 여기로 보내면 서버가 Gateway 로 풀어(또는 걸어)
되돌려 줍니다.

```
앱(사용자 PC) → 이 서버 /v1/drm/* → MIP Gateway(noSessiondo) → 다시 사용자 PC
```

앱 0.7.5 부터: 보안문서를 업로드하면 자동으로 해제해 쓰고("문서를 보안해제 중입니다"),
다운로드 버튼을 누르면 보안을 다시 걸어 내려줍니다("문서를 보안적용 중입니다").

## 설정 (.env)

`main.py` 옆 `.env` 파일에 적습니다. **API Key 는 코드/저장소에 절대 넣지 않습니다**
(`.gitignore` 에 `.env` 가 있습니다).

| 키 | 뜻 | 기본값 |
|---|---|---|
| `MIP_GATEWAY_BASE_URL` | Gateway 주소 | 운영 mipgw (개발은 명시 지정) |
| `MIP_API_KEY` | keyCode 인증 키 (**필수** — 없으면 DRM 만 503) | 없음 |
| `MIP_REQUESTOR_ACCOUNT` | 요청에 계정이 없을 때 쓸 기본 계정(마당 ID) | 없음 |
| `MIP_TIMEOUT` | Gateway 호출 제한시간(초) | 60 |
| `MIP_MAX_FILE_MB` | 받아 줄 파일 크기 상한 MB(넘으면 413) | 200 |
| `MIP_GATEWAY_IP` | 이름이 안 풀리는 폐쇄망에서 대신 붙을 IP(방화벽 '도착지' VIP) | 코드의 운영 VIP |
| `MIP_CLIENT_IP` | 게이트웨이에 보낼 업무시스템 IP(규격 필수). NAT 뒤면 **Outbound NAT IP** | 시작 시 자동 감지 |
| `MIP_TLS_MAX` | 구형 VIP 가 TLS 1.3 을 끊을 때만 `1.2` 로 고정 | 자동 |

같은 값을 명령줄(`--mip-base-url`, `--mip-api-key`, `--mip-account`, `--mip-timeout`,
`--mip-gateway-ip`, `--mip-client-ip`)로도 줄 수 있습니다. 환경별 Gateway (**기본은 운영**):

- 운영(기본): `https://mipgw.lguplus.co.kr/webapi/api/lguplusstreams/noSessiondo`
- 개발(테스트할 때만): `https://devmipgw.lguplus.co.kr/webapi/api/lguplusstreams/noSessiondo`

## API · Gateway 대응

| 이 서버 | Gateway method | 응답 |
|---|---|---|
| `POST /api/drm/encrypt` | `drmEncryptAPI` | 암호화된 파일 스트림 |
| `POST /api/drm/decrypt` | `drmDecryptAPI` | 복호화된 파일 스트림 |
| `POST /api/drm/secret` | `drmSecretAPI` | JSON (`S_DOC` / `N_DOC`) |
| `POST /api/drm/policy` | `drmPolicyAPI` | 파일 스트림 (`decodeType=encrypt\|decrypt`) |
| `GET /api/drm/health` | — | 설정 여부(키 값은 안 내보냄). `?probe=1` 이면 DNS 까지 확인 |
| `GET /api/drm/diagnose` · `/probe` · `/ask` · `/envoy` | — | 폐쇄망 네트워크 진단(재시작 없이) |

같은 경로가 `/v1/drm/...` 로도 열려 있습니다(앱이 쓰는 길). Swagger 는 `/docs`.

공통 파라미터는 서버가 채웁니다: `keyCode`(=`MIP_API_KEY`), `policyGCode=PG01`,
`requestorAccount`(요청 form 값 → 없으면 `MIP_REQUESTOR_ACCOUNT`). 앱은 requestorAccount 에
사용자 PC 의 whoami 사용자 이름을 기본으로 실어 보냅니다(도메인 접두는 뗌,
`B2B_SECURE_DOC_ACCOUNT` 로 덮어쓰기 가능).

Gateway 오류는 본문 JSON 을 그대로 실어 HTTP 로 구분해 줍니다:
`-100`(인증)→502, `-200`(업무: "복호화 대상 파일이 아닙니다" 등)→400, `-999`(서버)→502,
네트워크/타임아웃→504. **재시도는 하지 않습니다**(연동규격에 재시도 규정 없음).

## curl 예제

```bash
curl -X POST "http://localhost:8100/api/drm/encrypt" \
  -F "file=@sample.xlsx" -F "requestorAccount=testuser" -o sample_enc.xlsx

curl -X POST "http://localhost:8100/api/drm/decrypt" \
  -F "file=@sample_enc.xlsx" -F "requestorAccount=testuser" -o sample_dec.xlsx

curl -X POST "http://localhost:8100/api/drm/secret" \
  -F "file=@sample.xlsx" -F "requestorAccount=testuser"

curl -X POST "http://localhost:8100/api/drm/policy" \
  -F "file=@sample.xlsx" -F "requestorAccount=testuser" -F "decodeType=encrypt"
```

## 서버가 도는 중에 물어보기

터미널 하나뿐인 폐쇄망 서버를 위해, **파일로 질문**할 수 있게 해 두었습니다.

```
<log-root>/ask.txt 에 한 줄 적으면 → 콘솔에 답이 찍히고 <log-root>/ask_result.txt 에도 남습니다
예)  probe 172.28.11.30:443   /   envoy clusters 172.28.11.30   /   diagnose
```

서버를 띄우지 않고 답만 볼 수도 있습니다: `python main.py --ask "probe 172.28.11.30:443"`.
심층 진단 결과는 `<log-root>/_diagnostics/diagnose_<시각>.txt` 로도 남습니다.

---

## 보안 메모

- 읽을 파일 경로는 **서버를 켤 때의 인자로만** 정합니다. 요청으로 경로를 받지 않습니다 —
  받으면 외부에서 서버의 아무 파일이나 읽어갈 수 있습니다(임의 파일 읽기).
- 경로에 쓰이는 값(사용자·세션·파일명)은 전부 화이트리스트로 세탁합니다. 이걸 빼먹으면
  `../..` 로 서버 아무 곳에나 파일을 쓸 수 있습니다. 테스트로 고정해 두었습니다.
- 내부망 전용이라 인증은 **기본 없음**입니다. 필요하면 `--ingest-key`, `--admin-key` 를 주세요.
- 응답에 키 값(MIP keyCode 등)은 어디에도 싣지 않습니다.

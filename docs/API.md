# API 명세

`main.py`(버전) · `collector.py`(수집·관리) · `drm.py`(문서보안) 의 실제 코드에서 그대로 뽑은
명세입니다. **여기 적힌 필드는 전부 코드에 있는 것**이고, 코드에 없는 것은 적지 않았습니다.

## 공통 사항

### 경로 별칭

`main.py` 가 라우터를 두 번 붙입니다. 같은 엔드포인트가 두 경로로 열립니다.

| 라우터 | 경로 | `/v1` 별칭 |
|---|---|---|
| `collector.router` | `/logs/...` | `/v1/logs/...` |
| `collector.admin_router` | `/admin`, `/admin/...` | `/v1/admin`, `/v1/admin/...` |
| `drm.router` | `/api/drm/...` | `/v1/drm/...` |
| `main` 직접 | `/version`, `/health` | `/v1/version`, `/v1/health` |

앱은 로컬 `/v1` 프록시를 통해 나오므로 실제로는 `/v1/...` 만 씁니다. `/v1` 없는 경로는
서버에서 curl·브라우저로 확인할 때 편의용입니다.

### 인증

| 대상 | 켜는 방법 | 보내는 방법 | 안 맞을 때 |
|---|---|---|---|
| 수집 API (`/logs/*`) | `--ingest-key` (env `AXCELL_LOG_INGEST_KEY`) | 헤더 `X-B2B-Log-Key` | `401` "수집 인증 키가 필요합니다(X-B2B-Log-Key)." |
| 관리 API (`/admin*`) | `--admin-key` (env `AXCELL_LOG_ADMIN_KEY`) | 쿼리 `?key=...` **또는** 헤더 `X-Admin-Key` | `401` "관리자 키가 필요합니다." |
| 버전 API | 없음 | — | — |

키를 설정하지 않으면(기본) 인증 검사를 하지 않습니다. 관리 API 는 `key` 쿼리와
`X-Admin-Key` 헤더 중 **먼저 채워진 쪽**을 씁니다(`key or x_admin_key`).

### 공통 실패

| 코드 | 언제 | 본문 |
|---|---|---|
| `400` | 날짜 형식이 `YYYY-MM-DD` 가 아님 / 본문을 풀지 못함 / `kind` 가 `logs\|skills` 가 아님 | `{"detail": "..."}` |
| `401` | 인증 키 불일치 | `{"detail": "..."}` |
| `404` | 세션 폴더·파일·날짜 폴더 없음 | `{"detail": "..."}` |
| `413` | 업로드 조각·압축 해제 크기·zip 총합 상한 초과 | `{"detail": "..."}` |
| `422` | 필수 쿼리/본문 항목 누락 (FastAPI 기본) | FastAPI 검증 오류 |
| `503` | `--log-root` 가 지정되지 않음(수집 꺼짐) | `{"detail": "수집 저장 폴더가 지정되지 않았습니다(--log-root)."}` |

### 상한값 (`collector.py` 상수)

| 상수 | 값 | 뜻 |
|---|---|---|
| `MAX_CHUNK_B64` | 12 MB | 업로드 본문(base64 **문자열 길이**) 상한 |
| `MAX_DECODED_BYTES` | 32 MB | 압축을 푼 뒤 크기 상한 |
| `MAX_ZIP_BYTES` | 512 MB | zip 한 번에 담을 원본 총합 상한 |
| `MAX_SESSION_MB` | 300 (`--max-session-mb`) | 세션 하나가 받을 총 용량. 넘으면 `capped` |
| `_STALE_AFTER_SECONDS` | 600 | 이만큼 무소식이면 끊김(종료 추정) |
| `_ACTIVE_GAP_SECONDS` | 600 | 이벤트 간격이 이 이하일 때만 활성 시간으로 합산 |
| `_EVENTS_SCAN_MAX_BYTES` | 50 MB | 스캔할 로그 파일 하나의 상한(넘는 만큼 `skippedBytes`) |
| `_EVENTS_ERROR_ROWS_CAP` | 500 | 세션당 캐시할 오류 행 상한 |

### 이름 세탁 규칙

경로에 들어가는 값은 전부 세탁합니다. 허용 문자는 `0-9`, `A-Z`, `a-z`, 한글(`가-힣`,
`ㄱ-ㅎ`, `ㅏ-ㅣ`), `.`, `_`, `-`, 공백이고 나머지는 `_` 로 바뀝니다.

| 함수 | 쓰는 곳 | 길이 | 특징 |
|---|---|---|---|
| `safe_part(v, fallback, 80)` | 사용자·세션 폴더명 | 80자 | `\` `/` → `_`, `.`/`..` → fallback, 연속 `_` 는 하나로 |
| `safe_filename(v, fallback, 120)` | 파일 이름 | 120자 | 경로가 섞여 와도 **마지막 이름만** 남김, 확장자는 살려서 자름 |

---

# 1. 버전 확인 (`main.py`)

## GET /health · /v1/health

```json
{ "ok": true, "service": "axcell-version", "versionFile": "/data/public/versionTest/version.txt" }
```

`versionFile` 은 `--version-file` 로 받은 절대 경로(없으면 빈 문자열).

## GET /v1/models

플랫폼/게이트웨이가 "서비스가 살아있는지" 확인하는 전사 표준 프로브. **항상 200**.

```json
{ "object": "list", "data": [] }
```

`version.txt` 를 못 읽는 상태에서도 200 을 유지합니다(여기서 500 을 내면 서비스 자체가 죽은
것으로 오인돼 상위 점검이 전부 실패로 잡힙니다).

## GET /version · /v1/version

요청 파라미터 없음. 요청이 올 때마다 `version.txt` 를 다시 읽습니다.

응답 (`VersionOut`) — 모든 필드가 nullable 이고, 값이 없으면 `null` 로 나갑니다.

| 필드 | 형 | 설명 |
|---|---|---|
| `ok` | bool | 파일을 읽고 허용 목록을 만들었는지 |
| `version` | str? | 허용 목록 중 **가장 큰 버전**(4자리 정규화) |
| `normalized` | str? | `version` 과 같은 값 |
| `allowed` | str[]? | 허용 버전 전부(4자리 정규화, 중복 제거, 파일에 적힌 순서) |
| `downloadUrl` | str? | `--download-url` / `AXCELL_DOWNLOAD_URL` 값. 비었으면 `null` |
| `source` | str? | 읽은 파일의 절대 경로 |
| `updatedAt` | str? | 그 파일 수정 시각(UTC ISO8601) |
| `error` | str? | 실패 이유 |

```json
{
  "ok": true,
  "version": "0.8.4.0",
  "normalized": "0.8.4.0",
  "allowed": ["0.8.2.0", "0.8.3.0", "0.8.4.0"],
  "downloadUrl": null,
  "source": "/data/public/versionTest/version.txt",
  "updatedAt": "2026-09-03T06:35:12+00:00",
  "error": null
}
```

### version.txt 파싱 규칙

1. `utf-8-sig` 로 읽습니다(BOM 허용, 못 읽는 글자는 대체).
2. 줄을 앞뒤 공백 제거 → 빈 줄과 `#` 으로 시작하는 줄은 건너뜁니다.
3. 남은 줄이 `^\d{1,5}(\.\d{1,5}){0,3}$` (앞의 `v`/`V` 는 떼고 검사)에 맞으면 허용 목록에
   넣고, 안 맞으면 **첫 줄만** `bad` 로 기억합니다.
4. 각 줄을 4자리로 정규화(`normalize_version`: `v0.7.2` → `0.7.2.0`), 중복 제거.
5. `latest` = 숫자 튜플 비교로 가장 큰 값 → `version`, `normalized`.

실패 응답

| 상황 | 응답 |
|---|---|
| `--version-file` 미지정 | `ok:false`, `error:"서버에 version.txt 경로가 지정되지 않았습니다(--version-file)."` |
| 파일 없음 | `ok:false`, `source`, `error:"version.txt 를 찾을 수 없습니다: <경로>"` |
| 버전 형식인 줄이 하나도 없고 이상한 줄이 있음 | `ok:false`, `version:"<그 줄>"`, `error:"버전 형식이 아닙니다: '...' (예: 0.7.2.0)"` |
| 내용이 비었음 | `ok:false`, `error:"version.txt 가 비어 있습니다."` |
| 그 밖의 예외 | `ok:false`, `error:"<예외형>: <메시지>"` |

HTTP 상태는 위 모든 경우에도 **200** 입니다(본문의 `ok` 로 판단).

## GET /version/check · /v1/version/check

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `v` | 아니오(기본 `""`) | 앱이 가진 파일 버전. 예 `0.8.4.0`, `0.8.4`, `v0.8.4` |

응답은 `VersionOut` + 두 필드.

| 필드 | 형 | 설명 |
|---|---|---|
| `client` | str? | 정규화한 클라 버전. 정규화 실패 시 받은 값 그대로, 빈 값이면 `null` |
| `match` | bool? | `client` 가 `allowed` 안에 있으면 `true`. `ok:false` 이거나 `v` 가 비면 `null` |

```json
// GET /v1/version/check?v=0.8.1
{ "ok": true, "version": "0.8.4.0", "normalized": "0.8.4.0",
  "allowed": ["0.8.2.0", "0.8.3.0", "0.8.4.0"],
  "downloadUrl": null, "source": "...", "updatedAt": "...", "error": null,
  "client": "0.8.1.0", "match": false }
```

`match:false` → 앱이 "최신 버전으로 교체해 주세요" 안내를 띄웁니다.
`match:null` → 판단 불가(서버가 목록을 못 읽었거나 `v` 를 안 보냈음).

---

# 2. 수집 API (`collector.py`, 앱이 부른다)

## GET /logs/health · /v1/logs/health

```json
{
  "ok": true,
  "service": "axcell-log-collector",
  "root": "/data/public/versionTest/logs",
  "retentionDays": 0,
  "maxSessionMb": 300,
  "authRequired": false,
  "recentDays": ["2026-09-09", "2026-09-08", "2026-09-05"]
}
```

| 필드 | 설명 |
|---|---|
| `ok` | `--log-root` 가 지정됐는지(수집 켜짐) |
| `root` | 저장 폴더 절대 경로. 꺼져 있으면 `""` |
| `retentionDays` | 0 이면 안 지움 |
| `authRequired` | `--ingest-key` 가 설정됐는지 |
| `recentDays` | 최근 날짜 폴더 이름 최대 7개(내림차순) |

이 엔드포인트는 인증을 요구하지 않습니다(살아있는지 확인용).

## POST /logs/session/start · /v1/logs/session/start

요청 본문 (`SessionStart`)

| 필드 | 형 | 기본 | 설명 |
|---|---|---|---|
| `sessionId` | str | **필수** | 한 번 실행 = 한 세션. 예 `20260909-091530-13244-a1b2` |
| `user` | str | `""` | `whoami` 결과. 예 `kgm\hong` (폴더명은 세탁 후 `kgm_hong`) |
| `host` | str | `""` | PC 이름 |
| `appVersion` | str | `""` | 앱 파일 버전 |
| `startedAt` | str | `""` | 앱이 켜진 시각(ISO) |
| `osInfo` | str | `""` | OS 정보 → `session.json` 의 `os` |
| `pid` | int? | `null` | 앱 프로세스 id |
| `appDir` | str | `""` | 실행 폴더 |
| `logDir` | str | `""` | 앱의 로그 폴더 |
| `skillDir` | str | `""` | 앱의 스킬 폴더 |
| `extra` | dict | `{}` | 추가 정보. **`extra.org`** 에 조직 정보가 온다(아래) |

> `date` 항목은 **없습니다.** 세션 폴더 날짜는 항상 **서버의 오늘**(`_today()`)입니다.
> 자정을 넘겨 실행한 세션은 시작 폴더(전날)를 계속 씁니다 — 재요청 시 날짜 없이 최근 60개
> 날짜 폴더를 뒤져 같은 세션을 찾기 때문입니다.

`extra.org` (앱이 `whoami /fqdn` 을 파싱해 보냄, 없을 수 있음)

| 키 | 예 |
|---|---|
| `displayName` | `서영민` |
| `madangId` | `s0min` |
| `team` | `Foundation리서치팀` |
| `orgPath` | `LG유플러스 > CTO > AI R_D센터 > AI R_D Lab > Foundation리서치팀` |

응답

```json
{ "ok": true, "created": true,
  "path": "/data/public/versionTest/logs/2026-09-09/kgm_hong/20260909-091530-13244-a1b2",
  "date": "2026-09-09", "user": "kgm_hong", "sessionId": "20260909-091530-13244-a1b2",
  "totalBytes": 0, "capped": false }
```

| 필드 | 설명 |
|---|---|
| `created` | 새로 만들었으면 `true`. 이미 있으면 `false` (재접속 — `session.json` 의 `reconnects` +1, `lastSeenAt` 갱신) |

폴더를 만들 때 `logs/`, `skills/` 를 함께 만들고 `session.json` 을 씁니다.

## POST /logs/append · /v1/logs/append

로그 파일의 **늘어난 부분만** 이어붙입니다.

| 필드 | 형 | 기본 | 설명 |
|---|---|---|---|
| `sessionId` | str | **필수** | |
| `user` | str | `""` | |
| `date` | str | `""` | `YYYY-MM-DD`. 주면 그 날짜 폴더만 찾고, 비우면 최근 60일 폴더를 뒤진다 |
| `name` | str | **필수** | 원본 파일 이름. 예 `vba_pipeline_trace.jsonl` (세탁됨) |
| `offset` | int | `0` | 이 조각이 원본 파일의 몇 번째 바이트부터인지 |
| `encoding` | str | `"gzip+base64"` | 아래 표 참고 |
| `data` | str | `""` | 본문 |

`encoding` 처리

| 값 | 처리 |
|---|---|
| `"text"` | 문자열을 UTF-8 바이트로 |
| `gzip` 으로 **시작**하는 값 (`gzip+base64` 등) | base64 디코드 → gzip 해제 |
| 그 밖의 값 (`b64` 등) | base64 디코드만 |

응답

```json
{ "ok": true, "accepted": 4096, "size": 831488, "gap": 0,
  "path": ".../logs/vba_pipeline_trace.jsonl", "capped": false }
```

| 필드 | 설명 |
|---|---|
| `accepted` | 실제로 파일에 붙인 바이트 수(겹치는 재전송분은 잘라내므로 0 일 수 있음) |
| `size` | 이어붙인 뒤 서버 파일의 전체 크기 |
| `gap` | `offset` 이 서버가 가진 크기보다 클 때 그 차이(빈 구간). `session.json` 의 해당 파일 `gaps[]` 에도 `{at, missingBytes}` 로 남는다 |

중복/유실 처리

- `offset < 이미 받은 크기` → 겹치는 앞부분을 잘라내고 붙입니다(같은 줄이 두 번 안 들어감).
- `offset > 이미 받은 크기` → 그 차이를 `gap` 으로 기록하고 **그대로 이어붙입니다**
  (받은 건 일단 남긴다).

세션 상한 초과 시(200 으로 내려갑니다)

```json
{ "ok": true, "capped": true, "accepted": 0, "size": 0, "gap": 0,
  "error": "세션 상한(300MB)을 넘어 더 받지 않습니다." }
```

세션 폴더가 없으면 만들어서 받습니다(`recovered: true`, `note` 가 `session.json` 에 남고
서버 콘솔에 WARNING 이 찍힙니다).

## POST /logs/file · /v1/logs/file

스킬 zip 처럼 **통째로 하나인 파일**을 올립니다.

| 필드 | 형 | 기본 | 설명 |
|---|---|---|---|
| `sessionId` | str | **필수** | |
| `user` | str | `""` | |
| `date` | str | `""` | append 와 같음 |
| `kind` | str | `"skill"` | `skill` → `skills/`, `log` → `logs/`, `meta` → 세션 폴더 루트. 그 밖의 값은 `skills/` |
| `name` | str | **필수** | 파일 이름(세탁됨, 한글 허용) |
| `encoding` | str | `"gzip+base64"` | append 와 같음 |
| `data` | str | `""` | 본문 |
| `createdAt` | str | `""` | 주면 `session.json` 의 그 파일 항목에 `createdAt` 으로 저장 |

응답

```json
{ "ok": true, "duplicate": false, "path": ".../skills/월마감_정리.zip",
  "size": 25088, "capped": false }
```

- `duplicate: true` — 같은 이름의 파일이 **이미 있고 크기가 같으면** 다시 쓰지 않습니다.
- 상한 초과 시 `{"ok":true,"capped":true,"duplicate":false,"size":0,"error":"세션 상한(300MB)을 넘어 더 받지 않습니다."}`

## POST /logs/session/end · /v1/logs/session/end

| 필드 | 형 | 기본 | 설명 |
|---|---|---|---|
| `sessionId` | str | **필수** | |
| `user` | str | `""` | |
| `date` | str | `""` | |
| `endedAt` | str | `""` | 앱이 꺼진 시각. 비우면 서버 시각 |
| `reason` | str | `""` | 종료 사유 → `session.json` 의 `endReason` |

```json
{ "ok": true, "path": ".../20260909-091530-13244-a1b2", "totalBytes": 831488 }
```

`session.json` 에 `closed:true`, `endedAt`, `serverEndedAt`, `endReason`, `lastSeenAt` 을 씁니다.

## session.json 필드

| 필드 | 언제 채워지나 | 설명 |
|---|---|---|
| `sessionId`, `user`, `date` | start | 세탁된 값 |
| `userRaw` | start | 세탁 전 원본 `user` |
| `host`, `appVersion`, `pid`, `os`, `appDir`, `logDir`, `skillDir`, `startedAt`, `extra` | start | 요청 값 그대로 |
| `serverStartedAt` | start / 복구 | 서버 시각 |
| `closed`, `endedAt`, `endReason` | start(빈 값) → end | |
| `serverEndedAt` | end | |
| `lastSeenAt` | start / append / file / end | **끊김 판정과 체류 시간의 기준** |
| `totalBytes` | append / file | 누적 수신 바이트 |
| `files` | append / file | `{"logs/x.jsonl": {"bytes":…, "lastAt":…, "gaps":[…]}, "skills/y.zip": {"bytes":…, "lastAt":…, "createdAt":…}}` |
| `reconnects` | start 재요청 | 같은 세션으로 다시 시작한 횟수 |
| `capped` | 상한 초과 | `true` 면 더 안 받음 |
| `recovered`, `note` | 시작 요청 없이 자료가 먼저 왔을 때 | |

## 보관 정리 (retention)

`--retention-days` 가 0 보다 클 때만 동작합니다. `POST /logs/session/start` 가 올 때
**최대 1시간에 한 번** 확인해서, 이름이 `기준일보다 작은` 날짜 폴더를 통째로 지웁니다.
0(기본)이면 아무것도 지우지 않습니다.

---

# 3. 관리 API (`collector.py`, 대시보드가 부른다)

앱 쪽 프록시(`log_dash.py`)가 허용한 경로만 대시보드에서 부를 수 있습니다:
`stats`, `errors`, `sessions`, `dates`, `events`, `session.zip`, `day.zip`,
`session/detail`, `session/file`. 프록시는 `<수집서버>/v1/admin/<경로>` 로 중계합니다.

## GET /admin/sessions · /v1/admin/sessions

| 파라미터 | 필수 | 기본 | 설명 |
|---|---|---|---|
| `date` | 아니오 | `""` | `YYYY-MM-DD`. 비우면 전체(날짜 내림차순) |
| `user` | 아니오 | `""` | 사용자 폴더명 **정확히 일치**(세탁 후 비교) |
| `org` | 아니오 | `""` | `team` 또는 `orgPath` 부분일치(대소문자 무시) |
| `limit` | 아니오 | `200` | 1~2000. 이 개수를 채우면 순회를 멈춘다 |
| `key` / `X-Admin-Key` | 조건부 | | 관리자 키 |

응답: `{ ok, root, count, sessions[] }`

`sessions[]` 한 행

| 필드 | 형 | 설명 |
|---|---|---|
| `date`, `user`, `sessionId` | str | 폴더 이름 |
| `displayName`, `madangId`, `team`, `orgPath` | str | `session.json` 의 `extra.org`. 없으면 `""` |
| `appVersion`, `host` | str | |
| `startedAt` | str | `startedAt` 없으면 `serverStartedAt` |
| `endedAt` | str | |
| `closed` | bool | `session/end` 를 받았는지 |
| `stale` | bool | 끊김(종료 추정) — 아래 규칙 |
| `endReason` | str | |
| `recovered` | bool | 시작 요청 없이 만들어진 폴더인지 |
| `capped` | bool | 용량 상한에 걸렸는지 |
| `lastSeenAt` | str | 마지막 수신 시각 |
| `logFiles`, `skillFiles` | str[] | `logs/`, `skills/` 안의 이름(정렬) |
| `sizeBytes`, `sizeKb` | int / float | 세션 폴더 전체 크기(실제 파일 합계) |
| `path` | str | 세션 폴더 절대 경로 |
| `zipUrl` | str | `/admin/session.zip?date=…&user=…&session=…` (`/v1` 접두 없음) |
| `tokens` | obj? | `{total, prompt, completion, calls}`. 집계 실패 시 `null` |
| `activeMinutes` | float? | 활성 시간(분). 집계 실패 시 `null` |

`stale` 판정 (`_session_is_stale`)

1. `closed` 가 참이면 → `false`
2. `lastSeenAt` → `serverStartedAt` → `startedAt` 중 첫 값을 씀. 셋 다 없으면 → `true`
3. 그 시각이 **600초(10분)** 보다 오래됐으면 → `true`
4. 시각을 못 읽으면 → `false` (함부로 끊김 처리하지 않음)

`tokens`/`activeMinutes` 는 이벤트 집계 캐시(`_session_events`)를 재사용합니다 — 첫 스캔
이후에는 캐시 파일 하나만 읽습니다.

## GET /admin/dates · /v1/admin/dates

```json
{ "ok": true, "root": "/data/public/versionTest/logs",
  "dates": [ { "date": "2026-09-09", "users": ["kgm_hong", "kgm_lee"], "sessions": 5 } ] }
```

날짜 내림차순. `sessions` 는 그날 모든 사용자의 세션 폴더 수 합계.

## GET /admin/stats · /v1/admin/stats

폴더 순회 1회로 만드는 숫자입니다(로그 **내용은 읽지 않아** 가볍습니다).

| 파라미터 | 필수 | 기본 | 설명 |
|---|---|---|---|
| `from` | 아니오 | `""` | `YYYY-MM-DD` 이상 |
| `to` | 아니오 | `""` | `YYYY-MM-DD` 이하 |
| `user` | 아니오 | `""` | 사용자 폴더명 정확히 일치 |

응답

```json
{ "ok": true, "root": "...",
  "total": { "sessions": 120, "bytes": 91234567, "skills": 88, "logs": 480,
             "dwellMinutes": 5210.4, "openSessions": 2, "userCount": 7 },
  "byDate":  [ { "date": "2026-09-09", "sessions": 5, "bytes": 812345, "skills": 3,
                 "logs": 20, "dwellMinutes": 210.5, "userCount": 3,
                 "lastSeenAt": "2026-09-09T13:02:11" } ],
  "byUsers": [ { "user": "kgm_hong", "sessions": 20, "bytes": 4812345, "skills": 12,
                 "logs": 80, "dwellMinutes": 980.1, "userCount": 1,
                 "lastSeenAt": "2026-09-09T13:02:11" } ] }
```

- `bytes` — `session.json` 의 `totalBytes`. 그 값이 0 이면 폴더 실제 크기를 셉니다.
- `skills`, `logs` — 각 폴더의 **파일 개수**.
- `dwellMinutes` (체류 시간) — `startedAt`(없으면 `serverStartedAt`) →
  `endedAt`(없으면 `lastSeenAt`). 끝이 시작보다 앞이거나 값을 못 읽으면 0.
  **종료를 못 남기고 죽는 세션이 많아 `endedAt` 만 믿으면 대부분 0 분이 되기 때문입니다.**
- `openSessions` — `closed` 가 아니고 `stale` 도 아닌 세션 수(진짜 지금 켜져 있는 것).
- `byDate`/`byUsers` 의 `userCount` — 그 묶음에 등장한 서로 다른 사용자 수(사용자별 행은 1).
- `byDate`, `byUsers` 는 키 **내림차순** 정렬.
- 날짜 형식이 틀리면 `400`.

## GET /admin/events · /v1/admin/events

세션 로그(`logs/*.jsonl`)를 **전량** 파싱한 집계. 세션 캐시 덕에 두 번째 호출부터 빠릅니다.

| 파라미터 | 필수 | 기본 | 설명 |
|---|---|---|---|
| `from`, `to` | 아니오 | `""` | 날짜 범위 |
| `user` | 아니오 | `""` | 사용자 폴더명 정확히 일치 |

응답 최상위

| 필드 | 설명 |
|---|---|
| `scanned` | `{sessions, cached, files, bytes, skippedBytes}` — 몇 세션을 보고 몇 개가 캐시였는지 |
| `byEvent` | `[{event, count}]` 건수 내림차순 **상위 100** |
| `durations` | `[{event, count, avgMs, maxMs, totalMs}]` `totalMs` 내림차순 **상위 50** |
| `active` | `{minutes, byUser:[{user, minutes}] 상위 100, byDate:[{date, minutes}] 날짜 오름차순}` |
| `tokens` | `{prompt, completion, total, calls, byModel:[{model, prompt, completion, total, calls}] 상위 20, byUser:[{user, …}] 상위 100, byDate:[{date, prompt, completion, total, calls}] 날짜 오름차순}` |
| `fullRuns` | `{count, ok, error, totalMs, avgMs, byUser:[{user, count, ok, error}] 상위 100}` |
| `steps` | `{byLanguage:[{language, runs, ok, error, avgMs}], byStepIdx:[{stepIdx, runs, error}] 상위 100}` |
| `errorsByDate` | `[{date, count}]` 날짜 오름차순 |

### 집계 규칙 (`_scan_session_events`)

로그 한 줄이 JSON 이 아니면 조용히 건너뜁니다(강제 종료로 깨진 줄).

| 무엇 | 조건 | 읽는 필드 |
|---|---|---|
| 활성 시간 | 모든 레코드 | `ts` 또는 `timestamp` (ISO, 끝의 `Z` 허용) |
| 이벤트 건수 | `event` 가 비어 있지 않음 | `event` |
| 토큰 | `event == "llm.usage"` | `promptTokens`, `completionTokens`, `totalTokens`(0 이거나 없으면 앞의 둘의 합), `model`(없으면 `"?"`) |
| 전체실행 | `event` 가 **없고** `event_type == "agent.run"` | `status`(`"success"` → ok, 그 외 error), `latency_ms` |
| 소요시간 | `ms` (없으면 `totalMs`) 가 0 이상 숫자 | 이벤트별 `count`/`totalMs`/`maxMs` |
| 단계 실행 | `event` 가 `fullrun.step.ok\|error` 또는 `pipeline.step.ok\|error` | `language`(없으면 `"(미기록)"`), `stepIdx`(정수 0~499), `ms` |
| 오류 | 이벤트 이름(소문자)에 `.error`·`.fail`·`.failed`·`runtime_error`·`save_error`·`recover` 중 하나가 있고, `recovered`·`recover.ok` 는 아님 | `error`→`message`→`cause` 중 첫 값의 앞 200자, `stepIdx`, `stepId`, `ts` |

활성 시간 계산: 모아 둔 `ts` 를 초로 바꿔 정렬하고, 인접한 두 값의 차이가 **0 이상 600초
이하일 때만** 더합니다. 분으로 바꿔 소수 첫째 자리까지(`activeMinutes`).
→ 이벤트가 안 찍히는 '읽기만 하는' 시간은 자리비움으로 잡히는 근사입니다.

스캔 상한: 파일 하나에서 50MB 까지만 읽고, 넘는 만큼을 `skippedBytes` 로 알려줍니다.
오류 행은 세션당 500개까지 캐시합니다.

## GET /admin/errors · /v1/admin/errors

| 파라미터 | 필수 | 기본 | 설명 |
|---|---|---|---|
| `from`, `to` | 아니오 | `""` | 날짜 범위 |
| `user` | 아니오 | `""` | 사용자 폴더명 정확히 일치 |
| `limit` | 아니오 | `200` | 1~1000. **정렬 후** 자름 |

```json
{ "ok": true, "count": 2, "fullScan": true,
  "errors": [ { "date": "2026-09-09", "user": "kgm_hong",
                "sessionId": "20260909-091530-13244-a1b2",
                "file": "vba_pipeline_trace.jsonl", "ts": "2026-09-09T09:31:02",
                "event": "pipeline.step.error", "summary": "시트 'VIEW' 를 찾을 수 없습니다",
                "stepIdx": 1, "stepId": "abc123" } ] }
```

`ts` 문자열 **내림차순**(최신 먼저)으로 정렬한 뒤 `limit` 개를 남깁니다.
`fullScan: true` 는 파일 끝만 보는 예전 방식이 아니라 전량 스캔 결과라는 표시입니다.

## GET /admin/session/detail · /v1/admin/session/detail

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `user` | **예** | 사용자 폴더명 |
| `session` | **예** | 세션 폴더명 |
| `date` | 아니오 | 비우면 최근 60개 날짜 폴더를 뒤진다 |

```json
{ "ok": true, "date": "2026-09-09", "user": "kgm_hong",
  "sessionId": "20260909-091530-13244-a1b2",
  "logs":   [ { "name": "vba_pipeline_trace.jsonl", "sizeKb": 812.0 } ],
  "skills": [ { "name": "월마감_정리.zip", "sizeKb": 24.5,
                "steps": 7, "enabledSteps": 6,
                "stepTitles": ["1. 원본 시트 정리", "2. 헤더 찾기", "3. 합계 (꺼짐)"] } ] }
```

| 필드 | 설명 |
|---|---|
| `logs[].name` / `sizeKb` | `logs/` 안의 파일 이름과 KB(소수 첫째 자리) |
| `skills[].steps` | 스킬 zip 안 `*.logic.json` 의 `pipeline` 길이. 못 읽으면 `null` |
| `skills[].enabledSteps` | `enabled` 가 `false` 가 **아닌** 단계 수 |
| `skills[].stepTitles` | `"<번호>. <제목>"` 문자열, **최대 40개**. 제목은 `title`→`description`→`prompt` 중 첫 값의 첫 줄 60자, 없으면 `(설명 없음)`. 꺼진 단계는 뒤에 ` (꺼짐)` |
| `skills[].error` | 그 zip 을 못 읽었을 때만 붙는다: `"스킬 파일을 읽지 못했습니다: <이유>"` |

**깨진 zip 이 있어도 나머지는 정상 나열합니다**(행 단위로만 실패 표시).
세션 폴더가 없으면 `404 "그런 세션 폴더가 없습니다."`

## GET /admin/session/file · /v1/admin/session/file

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `user`, `session`, `kind`, `name` | **예** | `kind` 는 `logs` 또는 `skills` 만 |
| `date` | 아니오 | 비우면 최근 60개 날짜 폴더 탐색 |

응답: `application/octet-stream`,
`Content-Disposition: attachment; filename*=UTF-8''<URL 인코딩된 이름>`

| 실패 | 코드 |
|---|---|
| `kind` 가 `logs`/`skills` 가 아님 | `400 "kind 는 logs 또는 skills 입니다."` |
| 세션 폴더 없음 | `404 "그런 세션 폴더가 없습니다."` |
| 세탁 후 이름이 비었거나, 파일이 없거나, **부모 폴더가 `<세션>/<kind>` 가 아님** | `404 "그런 파일이 없습니다."` |

마지막 조건이 경로 탈출(`../`) 차단입니다 — 세탁(`safe_filename`)으로 경로 구분자를 없애고,
그래도 부모 디렉터리를 한 번 더 확인합니다.

## GET /admin/session.zip · /v1/admin/session.zip

| 파라미터 | 필수 |
|---|---|
| `date`, `user`, `session` | **전부 필수** |

세션 폴더의 **모든 파일**(`session.json` + `logs/` + `skills/`)을 zip 으로 내려줍니다.
zip 안의 경로는 `<세션ID>/...` 로 시작합니다. 파일명은
`<날짜>_<사용자>_<세션ID>.zip` (ASCII 대체명 + `filename*=UTF-8''` 둘 다 실림).

| 실패 | 코드 |
|---|---|
| 세션 폴더 없음 | `404` |
| 원본 총합 512MB 초과 | `413 "한 번에 내려받기엔 너무 큽니다. 날짜/사용자를 좁혀 주세요."` |

## GET /admin/day.zip · /v1/admin/day.zip

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `date` | **예** | `YYYY-MM-DD` |
| `user` | 아니오 | 주면 그날 그 사용자만 |

파일명은 `<날짜>.zip` 또는 `<날짜>_<사용자>.zip`.
실패: `400`(날짜 형식), `404`(폴더 없음), `413`(512MB 초과).

## GET /admin · /v1/admin

브라우저에서 zip 을 클릭으로 받기 위한 최소 HTML 목록(최대 500행).
컬럼: 날짜 / 사용자 / 세션 / 버전 / 상태 / 크기 / 로그·스킬 개수 / zip 링크.
상태는 `종료`(closed) · `수집중`(lastSeenAt 있음) · `-`.
`?key=` 를 주면 각 zip 링크에도 `&key=` 를 붙여 줍니다.

> 이 화면은 서버에 직접 접속할 수 있을 때만 유용합니다. 사내 PC 에서는 게이트웨이가
> 커스텀 헤더 없는 브라우저 접속을 막으므로 앱의 F9 대시보드를 쓰세요.

## 집계 캐시

```
<log-root>/.agg_cache/<날짜>/<사용자>/<세션ID>.json
  { "sig": "<이름>:<크기>:<mtime>|…", "v": 5, "agg": { … } }
```

- 캐시를 쓰는 조건: `sig` 가 같고 **`v` 가 5** 일 때.
- `sig` 는 그 세션 `logs/*.jsonl` 의 `이름:크기:정수 mtime` 을 `|` 로 이은 것.
- `agg` 구조: `{events, durations, byLanguage, byStepIdx, errors, files, bytes,
  skippedBytes, tokens, fullRuns, activeMinutes}`.
- 쓰기는 `.tmp` → `replace` (원자적 교체). 캐시 쓰기 실패는 무시하고 결과는 그대로 줍니다.
- **집계 규칙을 바꾸면 `v` 를 올려야 합니다.** 이력: v2 토큰 / v3 전체실행 / v4 활성시간 /
  v5 자리비움 10분.

---

# 4. 문서보안 (`drm.py`)

경로는 `/api/drm/...` 와 `/v1/drm/...` 둘 다 열려 있습니다. 요청은 `multipart/form-data`.

## GET /api/drm/health

| 파라미터 | 기본 | 설명 |
|---|---|---|
| `probe` | `""` | `1`/`true`/`yes` 면 Gateway 호스트 이름 풀이(DNS)까지 확인 |

```json
{ "ok": true, "service": "axcell-drm", "configured": true,
  "gatewayHost": "mipgw.lguplus.co.kr", "defaultAccount": true,
  "timeoutSeconds": 60, "maxFileMb": 200,
  "dns": { "ok": true, "addresses": ["…"] } }
```

`configured` 는 `MIP_API_KEY` 가 있는지, `defaultAccount` 는 기본 계정이 있는지 **여부만**
알려줍니다 — 키 값 자체는 어떤 응답에도 싣지 않습니다. `dns` 는 `probe` 를 켰을 때만 붙고,
실패하면 `{ok:false, error, hint}` 가 들어갑니다.

## POST /api/drm/encrypt · decrypt · secret · policy

| 엔드포인트 | form 항목 | Gateway method | 성공 응답 |
|---|---|---|---|
| `/encrypt` | `file`(필수), `requestorAccount`, `labelid` | `drmEncryptAPI` | 파일 스트림(또는 Gateway 가 JSON 을 주면 그 JSON) |
| `/decrypt` | `file`(필수), `requestorAccount` | `drmDecryptAPI` | 파일 스트림 |
| `/secret` | `file`(필수), `requestorAccount` | `drmSecretAPI` | JSON (`result` 가 `S_DOC`/`N_DOC`) |
| `/policy` | `file`(필수), `decodeType`(**필수**, `encrypt`\|`decrypt`), `requestorAccount` | `drmPolicyAPI` | 파일 스트림 |

`requestorAccount` 를 비우면 서버 기본 계정(`MIP_REQUESTOR_ACCOUNT`)을 씁니다.
공통 파라미터(`keyCode`, `policyGCode=PG01`)는 서버가 채웁니다.

전처리 실패 (`_prepare`)

| 상황 | 코드 |
|---|---|
| `MIP_API_KEY` 없음 | `503 "MIP_API_KEY 가 설정되지 않았습니다(.env 또는 환경변수)."` |
| 파일이 상한 초과 | `413 "파일이 너무 큽니다(최대 <N>MB)."` |
| 빈 파일 | `400 "빈 파일입니다."` |
| 계정도 기본 계정도 없음 | `400 "requestorAccount 가 필요합니다(서버 기본 계정도 없습니다)."` |

Gateway 오류 매핑 (본문에 Gateway JSON 을 그대로 실어 줍니다)

| Gateway | HTTP | 뜻 |
|---|---|---|
| `-100` | `502` | 인증(keyCode·허용 IP) |
| `-200` | `400` | 업무 오류(예: "복호화 대상 파일이 아닙니다") — 부르는 쪽이 분기 |
| `-999` / 해석 불가 | `502` | Gateway 서버 오류 |
| DNS·연결·타임아웃 | `504` | Gateway 까지 못 갔음 |

**재시도는 하지 않습니다**(연동규격에 재시도 규정 없음).

## 진단 엔드포인트

| 주소 | 하는 일 |
|---|---|
| `GET /api/drm/diagnose?call=true` | 심층 진단(A~G) 전체를 텍스트 줄로 |
| `GET /api/drm/probe?target=172.28.11.30:443&sni=` | 이름 풀이 → TCP → TLS → HTTP 단계별 프로브 |
| `GET /api/drm/ask?q=diagnose` | 한 줄 질문에 답(`probe …`, `envoy clusters …`, `diagnose`, `help`) |
| `GET /api/drm/envoy?what=clusters` | 사이드카(Envoy) 정보: `server_info\|clusters\|listeners\|stats\|runtime\|certs\|ready` |

서버가 도는 중에는 `<log-root>/ask.txt` 에 한 줄 적어도 같은 답을 콘솔과
`<log-root>/ask_result.txt` 에서 볼 수 있습니다. 서버를 띄우지 않고 물어보려면
`python main.py --ask "probe 172.28.11.30:443"`.

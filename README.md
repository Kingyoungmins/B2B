# AX-Cell 버전 확인 · 로그 수집 서버

AX-Cell 이 물어보는 것을 받아 주는 서버입니다. 하는 일은 둘입니다.

1. **최신 버전 알려주기** — version.txt 에 적힌 값을 그대로 답해 줍니다.
2. **로그/스킬 받아 쌓기** — AX-Cell 이 실행 중에 보내오는 로그와 스킬을
   `날짜 → 사용자 → 실행(세션)` 폴더에 쌓아 둡니다. 관리자가 세션 폴더를 zip 으로 받아
   그대로 들여다볼 수 있습니다. (아래 [로그 수집] 참고)

## 설치

```bash
pip install -r requirements.txt
```

## 실행

```bash
python main.py --version-file C:\axcell\version.txt --host 0.0.0.0 --port 8100
```

- `--version-file` : 최신 버전이 적힌 파일 경로 (필수)
- `--host` : 기본 `0.0.0.0` (외부에서 접속 가능)
- `--port` : 기본 `8100`

**version.txt 만 고치면 됩니다. 서버는 재시작하지 않아도 됩니다** — 요청이 올 때마다 다시 읽습니다.

## version.txt 형식

```
# 주석은 무시됩니다
0.7.2.0
```

`0.7.2` 처럼 짧게 적어도 `0.7.2.0` 으로 알아서 맞춰 비교합니다.

## 엔드포인트

| 주소 | 하는 일 |
|---|---|
| `GET /v1/models` | **전사 표준 프로브 — 항상 200 OK** (모델은 제공하지 않으므로 빈 목록) |
| `GET /health` · `/v1/health` | 서버 살아있는지 확인 |
| `GET /version` · `/v1/version` | 최신 버전 알려주기 |
| `GET /version/check?v=0.7.2.0` · `/v1/version/check?v=...` | 보내준 버전과 비교까지 해서 알려주기 |
| `GET /docs` | FastAPI 자동 문서(브라우저에서 직접 테스트 가능) |

`/v1/...` 별칭이 있는 이유는 아래 **AX-Cell 쪽 연결** 참고.

`/v1/models` 는 version.txt 를 못 읽는 상태여도 **200 을 유지**합니다. 여기서 500 을 내면
"서비스 자체가 죽은 것"으로 오인돼 상위 점검이 전부 실패로 잡히기 때문입니다.

### 응답 예시

```json
// GET /version
{
  "ok": true,
  "version": "0.7.2.0",
  "normalized": "0.7.2.0",
  "source": "C:\\axcell\\version.txt",
  "updatedAt": "2026-08-04T09:12:33+00:00"
}

// GET /version/check?v=0.7.1.0
{
  "ok": true,
  "version": "0.7.2.0",
  "normalized": "0.7.2.0",
  "client": "0.7.1.0",
  "match": false          // ← false 면 AX-Cell 이 "최신버전을 다운로드 해주세요" 안내
}
```

## AX-Cell 쪽 연결

AX-Cell 에서 **F9 → 개발자 설정 → 버전 확인** 칸에 이 서버 주소를 넣고 [버전 확인]을 누르면
현재 exe 버전과 서버 버전을 비교해 보여줍니다.

### 어떤 길로 오는가

AI 호출과 **똑같은 길**을 씁니다. 새로 정할 값은 **실제 주소 하나뿐**입니다.

```
AX-Cell 화면
  └ fetch(기존 Base URL + "/version",  헤더 X-B2B-Vllm-Base: <이 서버 주소>)
      └ serve_b2b 의 /v1/* 프록시 — 경로를 그대로 붙여 전달
          └ GET <이 서버 주소>/v1/version      ← 그래서 /v1 별칭이 필요하다
```

현재 버전은 AX-Cell 백엔드가 `GET /api/app/version` 으로 알려줍니다
(배포본이면 AX-Cell.exe 의 파일 버전, 소스 실행이면 `launch_b2b.py` 의 `CURRENT_VERSION`).

### 아직 안 한 것

지금은 **확인만** 합니다. 버전이 다를 때 뜨는 "최신버전을 다운로드 해주세요" 안내창과
확인 시 프로그램 종료는 최종 배포 전에 붙일 예정입니다.

## 테스트

```bash
python test_version_service.py     # 33개, Excel/네트워크 불필요
```

## 보안 메모

읽을 파일 경로는 **서버를 켤 때의 인자로만** 정합니다. 요청으로 경로를 받지 않습니다 —
받으면 외부에서 서버의 아무 파일이나 읽어갈 수 있습니다.

---

# 로그 수집

## 왜 있나

로그는 사용자 PC 의 `%LOCALAPPDATA%\B2B_logs` 에 쌓이고, **AX-Cell 을 다시 켜면 비워집니다**
(사용자 PC 에 부담을 주지 않으려는 의도된 동작). 자동백업 스킬은 실행파일 옆 `auto_backup` 에만
쌓입니다. 그래서 제보를 받고 "그때 그 로그 좀 보내 주세요" 를 부탁하면 이미 지워진 뒤인 경우가
많았습니다.

이제 AX-Cell 이 **켜져 있는 동안 알아서 조금씩** 이 서버로 보냅니다. 서버는 지우지 않고 계속
쌓습니다. 사용자는 아무것도 누르지 않아도 됩니다.

## 어떻게 쌓이나

`--log-root` 아래에 이렇게 쌓입니다. **한 번 켠 것 = 폴더 하나**라서, 그 실행의 로그와 그 실행에서
만들어진 스킬이 **항상 짝**으로 남습니다.

```
/data/public/versionTest/logs/
  2026-08-24/                                  ← 날짜
    kgm_hong/                                  ← 사용자 (whoami 결과, \ 는 _ 로)
      20260824-091530-13244-a1b2/              ← 실행 1회(세션)
        session.json     누가 / 어느 PC / 어느 버전 / 언제 켜고 껐는지
        logs/            vba_pipeline_trace.jsonl, runtime_load_trace.jsonl, vba_runner_fail.log …
        skills/          그 실행 중에 만들어진 자동백업 스킬 zip
```

- 로그는 **늘어난 부분만** 30초마다 이어서 올라옵니다(앱을 느리게 하지 않으려고).
- 전송이 실패하면 그 자리에서 멈췄다가 다음 주기에 이어서 보냅니다. 서버는 이미 받은 만큼을
  잘라내므로 같은 줄이 두 번 들어가지 않습니다.
- AX-Cell 이 강제 종료돼도 **그때까지 보낸 만큼은 서버에 남습니다** — 정작 로그가 필요한 상황이
  대개 그때라서 이렇게 만들었습니다.

## 관리자가 받는 법

브라우저로 `http://서버주소:8100/admin` 을 열면 날짜·사용자·세션 목록이 나오고, 줄 끝의
**[zip 받기]** 를 누르면 그 세션 폴더가 통째로 내려옵니다.

| 주소 | 하는 일 |
|---|---|
| `GET /admin` | 목록 화면(여기서 zip 클릭) |
| `GET /admin/sessions?date=2026-08-24&user=kgm_hong` | 같은 내용 JSON |
| `GET /admin/dates` | 날짜별 사용자·세션 수 |
| `GET /admin/session.zip?date=&user=&session=` | 세션 하나를 zip 으로 |
| `GET /admin/day.zip?date=2026-08-24` | 하루치 전체를 zip 으로(사용자 지정 가능) |

`--admin-key` 를 정하면 `?key=...` 또는 `X-Admin-Key` 헤더가 있어야 열립니다(기본은 인증 없음).

## 실행 옵션

```bash
python main.py --version-file /srv/axcell/version.txt \
               --log-root /data/public/versionTest/logs \
               --host 0.0.0.0 --port 8100
```

| 옵션 | 뜻 | 기본값 |
|---|---|---|
| `--log-root` | 수집한 자료를 쌓을 폴더(없으면 만듭니다) | `/data/public/versionTest/logs` |
| `--retention-days` | 이 일수보다 오래된 **날짜 폴더**를 지움 | `0` = 안 지움(계속 쌓임) |
| `--max-session-mb` | 한 실행(세션)당 받을 최대 용량 | `300` |
| `--ingest-key` | 보내는 쪽 인증 키(AX-Cell 이 `X-B2B-Log-Key` 로 보냄) | 없음 |
| `--admin-key` | 관리자 조회/다운로드 키 | 없음 |
| `--no-collector` | 로그 수집을 끄고 버전 확인만 함 | 꺼짐 |

폴더를 만들지 못하면(권한 등) 서버가 죽지 않고 `versionTest/logs` 로 물러나며, 어디에 쌓는지
시작 로그에 찍어 줍니다.

## AX-Cell 이 부르는 주소

버전 확인과 **같은 서버 주소·같은 Api-Key** 를 씁니다. 관리자가 따로 설정할 것이 없습니다.
(F9 → 개발자 설정의 버전 서버 주소를 바꾸면 로그도 그 주소로 따라갑니다)

| 주소 | 하는 일 |
|---|---|
| `POST /v1/logs/session/start` | 이번 실행의 폴더 만들기 |
| `POST /v1/logs/append` | 로그의 늘어난 부분 이어붙이기 |
| `POST /v1/logs/file` | 스킬 zip 올리기 |
| `POST /v1/logs/session/end` | 이 실행 끝 표시 |
| `GET /v1/logs/health` | 수집기 상태·저장 위치 확인 |

## 확인·문제 해결

```bash
curl http://127.0.0.1:8100/v1/logs/health     # {"ok":true,"root":"/data/public/versionTest/logs", ...}
```

- **아무것도 안 쌓인다** → `ok` 가 false 면 `--log-root` 폴더 권한을 보세요. AX-Cell 쪽은
  `http://127.0.0.1:18090/api/log-sync/status` 로 "어디로 얼마나 보냈는지"를 볼 수 있습니다.
- **특정 PC 만 안 올라온다** → 그 PC 에서 방화벽/프록시로 이 서버에 못 나가는 경우입니다.
- **끄고 싶다** → 서버는 `--no-collector`, 특정 PC 만이라면 그 PC 환경변수 `B2B_LOG_SYNC=0`.

## 테스트

```bash
python test_version_service.py     # 버전 확인 33개
python test_log_collector.py       # 로그 수집 60여 개 (경로 탈출 차단·중복 제거 포함)
```


---

# 문서보안 (DRM MIP Gateway)

## 왜 있나

사용자 PC 는 LGU+ MIP Gateway(문서보안 서버)를 직접 부를 수 없습니다(허용 IP 제한).
이 서버는 사내망에서 항상 떠 있으므로, AX-Cell 이 보안문서(AIP/DRM)를 여기로 보내면
서버가 Gateway 로 풀어(또는 걸어) 되돌려 줍니다.

```
AX-Cell(사용자 PC) → 이 서버 /v1/drm/* → MIP Gateway(noSessiondo) → 다시 사용자 PC
```

AX-Cell 0.7.5 부터: 보안문서를 업로드하면 자동으로 해제해 쓰고("문서를 보안해제 중입니다"),
다운로드 버튼을 누르면 보안을 다시 걸어 내려줍니다("문서를 보안적용 중입니다").

## Configuration

`.env` 파일(이 폴더, `main.py` 옆)에 적습니다. `.env.example` 을 복사해 시작하세요.
**API Key 는 코드/저장소에 절대 넣지 않습니다.**

| 키 | 뜻 | 기본값 |
|---|---|---|
| `MIP_GATEWAY_BASE_URL` | Gateway 주소 | **운영 mipgw** (개발은 명시 지정) |
| `MIP_API_KEY` | keyCode 인증 키 (**필수** — 없으면 DRM 만 503) | 없음 |
| `MIP_REQUESTOR_ACCOUNT` | 요청에 계정이 없을 때 쓸 기본 계정 | 없음 |
| `MIP_TIMEOUT` | Gateway 호출 제한시간(초) | 60 |

명령줄 인자(`--mip-base-url`, `--mip-api-key`, `--mip-account`, `--mip-timeout`)로도 덮어쓸 수
있습니다. 환경별 Gateway (**기본은 운영**):

- 운영(기본): `https://mipgw.lguplus.co.kr/webapi/api/lguplusstreams/noSessiondo`
- 개발(테스트할 때만 지정): `https://devmipgw.lguplus.co.kr/webapi/api/lguplusstreams/noSessiondo`

## APIs · Gateway mapping

| 이 서버 | Gateway method | 응답 |
|---|---|---|
| `POST /api/drm/encrypt` | `drmEncryptAPI` | 암호화된 파일 스트림 |
| `POST /api/drm/decrypt` | `drmDecryptAPI` | 복호화된 파일 스트림 |
| `POST /api/drm/secret` | `drmSecretAPI` | JSON (`S_DOC` / `N_DOC`) |
| `POST /api/drm/policy` | `drmPolicyAPI` | 파일 스트림 (`decodeType=encrypt\|decrypt`) |
| `GET /api/drm/health` | — | 설정 여부(키 값은 안 내보냄) |

같은 경로가 `/v1/drm/...` 로도 열려 있습니다(AX-Cell 이 쓰는 길). Swagger 는 `/docs`.

공통 파라미터는 서버가 채웁니다: `keyCode`(=MIP_API_KEY), `policyGCode=PG01`,
`requestorAccount`(요청 form 값 → 없으면 MIP_REQUESTOR_ACCOUNT).
AX-Cell 0.7.5 는 requestorAccount 에 **사용자 PC 의 whoami 사용자 이름**을 기본으로 실어
보냅니다(도메인 접두는 뗌, `B2B_SECURE_DOC_ACCOUNT` 로 덮어쓰기 가능).

Gateway 오류는 본문 JSON 을 그대로 실어 HTTP 로 구분해 줍니다:
`-100`(인증)→502, `-200`(업무: "복호화 대상 파일이 아닙니다" 등)→400, `-999`(서버)→502,
네트워크/타임아웃→504. **재시도는 하지 않습니다**(연동규격에 재시도 규정 없음).

## curl 테스트 예제

```bash
# 암호화
curl -X POST "http://localhost:8100/api/drm/encrypt" \
  -F "file=@sample.xlsx" -F "requestorAccount=testuser" -o sample_enc.xlsx

# 복호화
curl -X POST "http://localhost:8100/api/drm/decrypt" \
  -F "file=@sample_enc.xlsx" -F "requestorAccount=testuser" -o sample_dec.xlsx

# 비밀문서 확인
curl -X POST "http://localhost:8100/api/drm/secret" \
  -F "file=@sample.xlsx" -F "requestorAccount=testuser"

# 정책 기반 암호화
curl -X POST "http://localhost:8100/api/drm/policy" \
  -F "file=@sample.xlsx" -F "requestorAccount=testuser" -F "decodeType=encrypt"
```

## 테스트

```bash
python test_drm_service.py                            # 가짜 Gateway 로 44+개 (기본)
RUN_MIP_INTEGRATION_TEST=true python test_drm_integration.py   # 실제 Gateway (허용 IP 서버에서만)
```

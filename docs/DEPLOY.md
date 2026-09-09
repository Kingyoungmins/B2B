# 보안망 배포 체크리스트

**핵심 한 줄: 파일을 복사했으면 서버를 다시 띄워야 새 코드가 돕니다.**
(`version.txt` 만 예외 — 요청마다 다시 읽습니다)

배포 대상 폴더(운영 기준): `/data/public/versionTest/`
포트: `8100` / 저장 폴더: `/data/public/versionTest/logs`

아래 순서를 그대로 따라가세요. 각 단계에 **확인 명령**이 붙어 있습니다. 확인이 안 되면 다음
단계로 넘어가지 말고 [문제 해결](#문제-해결)로 갑니다.

---

## 0. 배포 전 (개발 PC에서)

```bash
cd C:\Users\...\versionTest

set PYTHONIOENCODING=utf-8

python test_version_service.py
python test_version_allowlist.py
python test_log_collector.py
python test_admin_events.py
python test_org_in_admin.py
python test_stale_sessions.py
python test_token_stats.py
python test_session_detail.py
python test_active_time.py
python test_startup_selfcheck.py
python test_drm_service.py
```

- 전부 `RESULT: ALL PASS` 여야 합니다.
- `test_dashboard_api.py` 는 2026-08-24 에만 통과합니다(날짜 고정 테스트 — 실패해도 서버 문제가
  아닙니다. `docs/LESSONS.md` 5번 참고).
- **집계 규칙을 고쳤다면** `collector.py` 의 캐시 버전 `v` 를 올렸는지 확인
  (`_session_events` 안의 읽기 조건과 쓰기 두 곳). 안 올리면 배포해도 화면 숫자가 안 바뀝니다.

체크

- [ ] 테스트 전부 통과
- [ ] 캐시 `v` 확인/증가 (집계 로직을 바꾼 경우)
- [ ] 올릴 파일 목록 확정 (`main.py` / `collector.py` / `drm.py` / `version.txt` 중 무엇인지)

---

## 1. 파일 복사

사내 절차대로 파일을 `/data/public/versionTest/` 에 덮어씁니다.

| 무엇을 바꿨나 | 올릴 것 |
|---|---|
| 수집·집계·관리 API | `collector.py` |
| 버전 API·시작 옵션·자가진단 | `main.py` |
| 문서보안 | `drm.py` |
| 허용 버전 목록만 | `version.txt` (**재시작 불필요**) |
| 의존성 버전 | `requirements.txt` (+ `pip install -r` 다시) |

> ### ⚠ 순서 규칙
> **여러 줄 `version.txt`(허용 목록)를 쓰려면 `main.py` 를 먼저 또는 같이 올리고 재시작한 뒤에**
> `version.txt` 를 여러 줄로 바꾸세요. 구버전 `main.py` 는 **첫 줄만** 읽어서 엉뚱한 버전과
> 비교합니다(멀쩡한 앱에 교체 안내가 뜨거나, 막아야 할 버전이 통과합니다).

체크

- [ ] 파일 복사 완료 (`ls -l /data/public/versionTest/*.py` 로 시각 확인)
- [ ] `version.txt` 를 여러 줄로 바꿀 계획이면 `main.py` 도 같이 올렸다

```bash
ls -l /data/public/versionTest/
# main.py / collector.py 의 수정 시각이 방금인지 눈으로 확인
```

---

## 2. 지금 돌고 있는 서버 확인 → 중지

먼저 **어떤 방식으로 떠 있는지** 확인합니다(서버마다 다릅니다).

```bash
# 포트를 잡고 있는 프로세스 찾기
ss -ltnp | grep 8100          # 또는
sudo lsof -i :8100            # 또는
ps -ef | grep "[m]ain.py"

# systemd 서비스로 등록돼 있나?
systemctl status axcell-version
```

방식별 중지 명령

| 방식 | 중지 |
|---|---|
| systemd | `sudo systemctl stop axcell-version` |
| `nohup` / 터미널 직접 | `kill <PID>` (안 죽으면 `kill -9 <PID>`) |
| 컨테이너/파드 | 파드를 다시 시작(`kubectl rollout restart …` 또는 파드 삭제 후 재생성) — 새 파드가 새 파일을 읽습니다 |
| 개발 PC(`start_log_server.bat`) | 서버 창에서 **Ctrl+C** 또는 창 닫기 |

> `start_log_server.bat` 을 다시 두 번 클릭하는 것으로는 안 됩니다 — 이미 떠 있으면
> "[알림] 수집 서버가 이미 떠 있습니다. 관리자 화면만 엽니다." 하고 **옛 서버를 그대로 씁니다.**

> ### 서버가 꺼져 있는 동안 사용자에게 보이는 것
> 앱은 켤 때 이 서버의 `GET /v1/version` 을 **3초 제한**으로 부릅니다. 응답을 못 받으면
> **"점검중입니다. 문의사항이 있으시면 팀즈로 문의 부탁드립니다"** 팝업이 뜹니다([확인] 누르면
> 계속 사용 가능). 그래서 **중지 → 재시작은 붙여서 짧게**, 되도록 사용이 적은 시간에 하세요.
> 이미 켜져 있는 앱은 영향 없습니다(버전 확인은 실행당 1회). 로그 전송은 실패하면 다음 주기에
> 이어서 보내므로 유실되지 않습니다.

체크

- [ ] 프로세스가 정말 없어졌다
```bash
ss -ltnp | grep 8100     # 아무것도 안 나와야 한다
curl -s -m 2 http://127.0.0.1:8100/v1/logs/health || echo "꺼짐 확인"
```

---

## 3. 다시 켜기

```bash
# systemd
sudo systemctl start axcell-version
systemctl status axcell-version --no-pager

# 직접 띄울 때 (운영 옵션 그대로)
cd /data/public/versionTest
nohup python3 main.py --version-file /data/public/versionTest/version.txt \
                      --log-root     /data/public/versionTest/logs \
                      --download-url "http://다운로드주소/B2B_설치.zip" \
                      --host 0.0.0.0 --port 8100 > version.log 2>&1 &
```

시작 로그에 이렇게 떠야 정상입니다.

```
[AX-Cell 버전 서버] version.txt = /data/public/versionTest/version.txt
[AX-Cell 버전 서버] http://0.0.0.0:8100/version
[AX-Cell 수집] 저장 위치 = /data/public/versionTest/logs
[AX-Cell 수집] 보관 = 무제한 / 세션당 최대 300MB / 수집 인증 없음
[AX-Cell 수집] 관리자 화면 http://0.0.0.0:8100/admin
[문서보안] Gateway = https://mipgw.lguplus.co.kr/...
[AX-Cell] 서버를 먼저 띄웁니다 — 시작 점검/진단은 5초 뒤 백그라운드에서 돕니다.
INFO:     Uvicorn running on http://0.0.0.0:8100
```

- **저장 위치가 `--log-root` 와 다르게 찍히면** 폴더를 못 만들어 `main.py` 옆 `logs` 로 물러난
  것입니다(권한 확인).
- 시작 점검·진단은 5초 뒤 백그라운드에서 돕니다. 그것 때문에 기동이 늦어지지는 않습니다.

체크

- [ ] 시작 로그에 저장 위치·보관 정책이 찍혔다
- [ ] `--log-root` 가 의도한 경로다

---

## 4. 기본 확인 (같은 서버에서 curl)

```bash
# (1) 살아있나 — 플랫폼 프로브와 같은 경로
curl -s http://127.0.0.1:8100/v1/models
# → {"object":"list","data":[]}

# (2) 수집기 상태·저장 위치
curl -s http://127.0.0.1:8100/v1/logs/health
# → {"ok":true,"service":"axcell-log-collector","root":"/data/public/versionTest/logs",
#    "retentionDays":0,"maxSessionMb":300,"authRequired":false,"recentDays":[...]}

# (3) 버전 — 허용 목록이 배열로 오나
curl -s http://127.0.0.1:8100/v1/version
# → {"ok":true,"version":"0.8.4.0","allowed":["0.8.2.0","0.8.3.0","0.8.4.0"], ...}

# (4) 비교 — 목록 안/밖
curl -s "http://127.0.0.1:8100/v1/version/check?v=0.8.4"   # → "match":true
curl -s "http://127.0.0.1:8100/v1/version/check?v=0.7.0"   # → "match":false
```

체크

- [ ] (1) `200` + 빈 목록
- [ ] (2) `ok:true` 이고 `root` 가 의도한 폴더
- [ ] (3) **`allowed` 배열이 있다** ← 이게 없으면 구버전 `main.py` 가 도는 것
- [ ] (4) 목록 안은 `true`, 밖은 `false`

---

## 5. 새 API 확인 (배포가 실제로 반영됐는지)

**"파일이 있다"가 아니라 "새 엔드포인트가 응답한다"로 확인합니다.** 이 단계를 건너뛰어서
2026-09-03 에 하루를 날렸습니다.

```bash
# 최근 세션 하나를 골라 값을 꺼낸다
curl -s "http://127.0.0.1:8100/v1/admin/sessions?limit=1"
# → sessions[0] 의 date / user / sessionId 를 복사

# 세션 상세 (2026-09-03 추가)
curl -s "http://127.0.0.1:8100/v1/admin/session/detail?date=<날짜>&user=<사용자>&session=<세션ID>"
# → {"ok":true,"logs":[...],"skills":[{"steps":N,"enabledSteps":M,"stepTitles":[...]}]}

# 이벤트 집계 — 새 항목이 다 있나
curl -s "http://127.0.0.1:8100/v1/admin/events" | head -c 600
# → scanned / byEvent / durations / active / tokens / fullRuns / steps / errorsByDate
```

라우트가 없으면(= 옛 프로세스) `{"detail":"Not Found"}` 가 옵니다. 세션이 없을 때의 404 는
`{"detail":"그런 세션 폴더가 없습니다."}` 이므로 **본문으로 구분할 수 있습니다.**

체크

- [ ] `/v1/admin/session/detail` 이 `ok:true` (또는 최소한 "그런 세션 폴더가 없습니다" 404)
- [ ] `/v1/admin/events` 응답에 `active`, `tokens`, `fullRuns` 가 있다
- [ ] `/v1/admin/sessions` 각 행에 `tokens`, `activeMinutes`, `team`, `orgPath` 가 있다

집계 로직을 바꿨다면 여기서 **숫자가 실제로 바뀌었는지**까지 봅니다. 안 바뀌면 캐시 `v` 를
안 올린 것입니다.

```bash
# 최후의 수단 — 캐시를 비우고 다시 계산시킨다(첫 조회가 느려집니다)
rm -rf /data/public/versionTest/logs/.agg_cache
curl -s "http://127.0.0.1:8100/v1/admin/events" | head -c 200
```

---

## 6. 대시보드에서 최종 확인 (사용자 PC)

앱을 켜고 **F9 → 관리 대시보드**를 엽니다. 데이터는 앱 프록시(`/api/logdash/*`)를 지나
이 서버의 `/v1/admin/*` 로 갑니다.

체크

- [ ] 실행 목록이 뜬다(빈 화면이면 프록시 설정 = F9 의 버전 서버 주소 확인)
- [ ] 팀/이름 칸이 보인다(구버전 앱 세션은 `-` 가 정상)
- [ ] 실행 목록의 한 줄을 **펼치면** 로그 파일 목록과 스킬 단계가 나온다
      ("상세를 불러오지 못했습니다" → 서버 재시작이 안 된 것)
- [ ] 활성 시간·토큰 칸에 값이 있다
- [ ] 종료된 세션이 "종료" 또는 "종료(추정)" 으로 보인다(전부 "수집 중"이면 이상)

---

## 7. 되돌리기

새 코드에 문제가 있으면 **파일을 이전 버전으로 되돌리고 다시 재시작**합니다(복사만 하면 안 되는
것은 똑같습니다).

- 급하게 버전 확인만 살리려면 `--no-collector` 로 띄웁니다(수집·대시보드만 꺼짐).
- 문서보안만 문제면 `.env` 의 `MIP_API_KEY` 를 비웁니다 → DRM 만 503, 나머지는 정상.
- 집계 값이 이상하면 `.agg_cache` 를 지웁니다(데이터는 안 지워집니다 — 캐시일 뿐).
- **`logs/` 는 어떤 경우에도 지우지 않습니다.** 사용자 PC 에는 이미 없는 자료입니다.

---

## 문제 해결

| 증상 | 원인 / 대응 |
|---|---|
| 새 API 가 `{"detail":"Not Found"}` | 옛 프로세스가 도는 중. 2~3단계를 다시 (진짜 죽었는지 `ss -ltnp` 로 확인) |
| `/v1/version` 에 `allowed` 가 없다 | 구버전 `main.py`. `main.py` 를 올리고 재시작 |
| 멀쩡한 앱에 교체 안내가 뜬다 | `version.txt` 에 그 버전 줄이 있는지 + `main.py` 가 최신인지 |
| `/v1/logs/health` 가 `ok:false` | `--log-root` 미지정 또는 폴더 권한. 시작 로그의 저장 위치 확인 |
| 저장 위치가 `versionTest/logs` 로 찍힌다 | 지정한 폴더를 못 만든 것(권한). 폴더 소유자·권한 확인 |
| 화면 숫자가 안 바뀐다 | 캐시 `v` 미증가. `v` 를 올려 재배포하거나 `.agg_cache` 삭제 |
| 포트가 이미 사용 중 | 옛 프로세스가 살아 있음. 2단계로 확실히 중지 |
| 파드가 계속 재시작된다 | `GET /v1/models` 가 200 을 못 주는 상태. 기동을 막는 무거운 작업이 들어갔는지 확인(점검은 백그라운드여야 함) |
| 문서보안만 503 | `MIP_API_KEY` 없음. `.env` 확인 |
| 문서보안이 `-100` | keyCode 또는 **허용 IP** 문제. `curl "…/api/drm/health?probe=1"` 과 `…/api/drm/diagnose` 로 확인 |
| 서버 터미널을 못 쓰는데 진단이 필요하다 | `<log-root>/ask.txt` 에 한 줄 적으면 콘솔과 `ask_result.txt` 에 답이 남습니다 |

---

## 참고

- 설치·서비스 등록·방화벽·끄기 등 서버 자체 운영은 `command.txt` 에 더 자세히 있습니다.
- 엔드포인트 필드 상세는 [API.md](API.md).
- 왜 이런 순서인지(실측 사례)는 [LESSONS.md](LESSONS.md) 1번·2번.

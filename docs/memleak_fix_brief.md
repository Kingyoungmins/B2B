# 유휴 메모리 누수 수정 지침서 (WebView2 renderer / 프론트 JS)

> 다른 작업자(사람 또는 Claude Code)가 맥락 없이 바로 착수할 수 있도록 자체 완결형으로 작성했습니다.
> **원인은 라이브 측정으로 이미 확정**되었으니, 정확한 JS 지점 특정 → 최소 수정 → 재측정 검증만 하면 됩니다.

## 0. TL;DR
- **증상:** 앱을 장시간 유휴로 켜두면 **"할당(commit/private) 메모리가 계속 증가"** 하는데 **"사용(working set)은 그대로."**
- **확정 원인:** **B2B WebView2 renderer 프로세스(= SPA의 JavaScript)** 의 **핸들 누수 + private 메모리 완만한 단조 증가.** 유휴 상시 타이머가 tick마다 "핸들을 쥔 객체"를 안 놓아주고 쌓는 것으로 추정.
- **무죄(건드리지 말 것):** Python 백엔드(`serve_b2b.py`), `B2B_NativeHost`, WebView gpu/browser, **EXCEL.EXE** — 전부 안정/무관.
- **수정 범위:** `scripts/*.js`(프론트) 안에서만. 백엔드/COM/엑셀/네이티브 호스트는 손대지 말 것.

## 1. 저장소 / 실행
- 경로: `B2B/` (브랜치/태그 `ver0.6.1.a`)
- 구성: Python 백엔드 `serve_b2b.py` + 네이티브 셸 `native_host/B2B_NativeHost.exe`(WebView2 호스팅) + 브라우저 SPA(`index.html` + `scripts/*.js`).
- 실행: `python serve_b2b.py` (또는 `launch_b2b.py` / `start_b2b.bat`).
- ⚠️ **먼저 실행 중인 빌드가 현재 소스와 일치하는지 확인.** 구버전 배포 EXE면 이미 고쳐진 누수(§3의 chat-ui RAF)가 남아있을 수 있음.

## 2. 확정된 원인 (측정 완료 — 재조사 불필요)

### 범인 프로세스 식별법
`msedgewebview2.exe` 중 **`--type=renderer`** 이고 커맨드라인에
`--webview-exe-name=B2B_NativeHost.exe` + `--user-data-dir=...\B2B_WebView2\...` 를 가진 것.
(부모 프로세스 체인이 `B2B_NativeHost.exe` → 이게 B2B의 SPA JavaScript 실행부.)

### 측정 증거 (순수 유휴 약 68분, 30초 간격 135샘플)
B2B renderer의 **Windows 핸들 시계열(30초 간격):**
```
230 254 262 270 278 ... 970 982 990 998   ← 쉬지 않고 +8/30s 단조 증가 (약 47분에 998)
10 18 26 34 ... 318 326                     ← renderer 재생성 시 리셋 → 다시 처음부터 또 채움
```
- 핸들: **30초당 ~+8개, 거의 완전 단조증가**(증가 129회 / 감소 3회). 시간당 ~960개.
- private 메모리: `84 → 101MB` 역시 **단조 증가**(renderer 수명당). working set은 flat.
- → **"찼다가 재생성, 또 참"** 의 톱니 패턴이 곧 사용자가 본 "할당이 계속 참"의 정체.

### 무죄 (전부 flat — 원인 아님)
| 프로세스 | 결과 |
|---|---|
| `python` (백엔드 `serve_b2b`) | priv 59→59MB, 스레드 263, 핸들 2 — 완전 flat |
| `B2B_NativeHost` | flat |
| WebView gpu / browser | flat (browser 핸들은 오히려 감소) |
| `EXCEL.EXE` | 측정 내내 실행되지도 않음 — 무관 |

## 3. 유력 코드 지점 (여기부터 조사)
유휴에도 항상 도는 상시 타이머가 tick마다 핸들 쥔 객체를 누적하는 것으로 추정. 핸들 증가율(~8/30s)이
아래 타이머 총 tick 수(5초 미러 6 + 15초 2종 4 ≈ 10회/30s)와 맞물림 → **tick당 1개꼴**:

- **`scripts/server-monitor.js`** — `pingHealth`(≈39–54행): tick마다 `new AbortController()` + `setTimeout` + `fetch`.
  성공 시 그 `setTimeout`을 **`clearTimeout` 하지 않으면 타이머가 쌓임**(가장 흔한 핸들 누수). `poll`(≈179행, 15초), `autoReconnect`(≈118행) 인터벌 중복 생성 여부도 확인.
- **`scripts/lifecycle.js`** — 핑 `fetch`(≈41행, 15초).
- **`scripts/excel-mirror.js`** — `hideInactive` 인터벌(≈2078행, 5초). (1461/1473/1485 미러 폴링은 세션 게이트라 유휴엔 안 돎 → 제외.)
- **`scripts/chat-ui.js`** — `requestAnimationFrame` 루프(≈3177–3191행): 과거 "장시간 구동 시 점점 무거워짐" 실누수.
  **현재 소스엔 수정돼 있음** — 실행 빌드가 이 수정 포함하는지 반드시 확인.

### 핸들 증가 JS 흔한 원인 체크리스트
- `setInterval`/`setTimeout` 재생성 시 이전 것 `clear` 안 함 (타이머 stacking)
- `AbortController` + 타임아웃을 완료 후 `clearTimeout` 안 함
- 반복 경로에서 `addEventListener`만 하고 `removeEventListener` 없음
- `WebSocket`/`EventSource` 재연결 시 이전 것 `close` 안 함
- `URL.createObjectURL` 후 `revokeObjectURL` 없음

## 4. 정확한 지점 특정 (수정 전 필수 — 추측 금지)
1. B2B WebView **DevTools** 열기 (앱 F9 개발자 모드, 또는 WebView2를 `--remote-debugging-port=9222`로 띄워 `edge://inspect` attach).
2. **Performance monitor** 탭에서 유휴로 두고 **JS event listeners / DOM Nodes** 추이 확인 → 어느 카운터가 단조 증가하는지.
3. 또는 **30분 간격 heap snapshot 2장 diff** → retained 증가 객체 확인(타이머 콜백/AbortController/리스너 등).
4. 그래도 안 잡히면, 상시 타이머를 하나씩 임시로 꺼보며 핸들 증가가 멈추는 타이머를 이분 탐색.

## 5. 수정 원칙
- **기능 유지, 누수만 제거.** 헬스체크/핑/미러 타이머 자체를 없애지 말 것.
- tick 자원을 대칭적으로 해제: 완료 시 `clearTimeout`, 인터벌 재생성 전 `clearInterval`, `addEventListener`↔`removeEventListener`, 네트워크 객체 abort/close.
- **`scripts/*.js` 최소 수정.** `serve_b2b.py`/COM/엑셀/네이티브 호스트는 건드리지 말 것.

## 6. 검증 (반드시 재측정)
수정 후 **유휴에서 renderer 핸들이 단조 증가하지 않아야 함.** 측정(PowerShell, 30초마다 CSV):
```powershell
$out="$env:LOCALAPPDATA\B2B_logs\mem_watch.csv"
"time,name,pid,privMB,wsMB,vmMB,threads,handles" | Out-File -Encoding utf8 $out
while($true){ $t=(Get-Date).ToString("HH:mm:ss")
  Get-Process | ? { $_.PrivateMemorySize64 -gt 20MB } | % {
    "{0},{1},{2},{3:N0},{4:N0},{5:N0},{6},{7}" -f $t,$_.ProcessName,$_.Id,`
     ($_.PrivateMemorySize64/1MB),($_.WorkingSet64/1MB),($_.VirtualMemorySize64/1MB),$_.Threads.Count,$_.HandleCount | Add-Content $out }
  Start-Sleep 30 }
```
- B2B 켜고 **아무것도 안 한 채 30~60분** 방치 → B2B renderer(§2 식별법) **핸들·private가 평평(톱니±)하면 성공.** (수정 전엔 30초당 ~+8)
- **두 상황 모두 테스트:** (a) 워크북 안 연 상태, (b) 엑셀 워크북 연 상태.
- ⚠️ 같은 로그에 `darkFlash DN-D` 같은 **무관한 3rd-party 앱**이 핸들을 크게 흘릴 수 있으니, **반드시 B2B renderer PID만** 보고 판단.

## 7. 산출물
- 변경 파일/라인 요약 + "무엇이 tick마다 쌓였고 어떻게 해제했는지" 설명.
- 수정 전/후 핸들 추이(CSV 수치)로 **누수 해소 증거** 제시.

---
*근거: 이 저장소 `serve_b2b.py`(백엔드)·`scripts/*.js`(프론트)·`native_host/`(셸) 코드 분석 + `%LOCALAPPDATA%\B2B_logs\mem_watch.csv` 라이브 프로세스 계측(프로세스 트리로 B2B WebView2 renderer 격리). 원인 분석 단계까지만 수행, 코드 수정은 미포함.*

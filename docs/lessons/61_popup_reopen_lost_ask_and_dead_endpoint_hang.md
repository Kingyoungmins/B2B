# 61. AI 도움이 "창만 열리고 아무것도 안 뜸" / "확인 중"에서 안 넘어감 — 팝업 재오픈 증발 + 죽은 LLM 주소

날짜: 2026-09-09 / 버전: 0.8.4

## 증상(사용자 제보, 다른 PC)

1. 스킬 생성 중 오류 → 오류 창의 [AI 도움에게 진단 요청] → **창만 켜지고 아무것도 안 뜸**
2. 검산 질문 → "확인 중…" 에서 더 진행 안 됨. "?" 를 보내도 같은 말만. 로딩 표시 없음

로그가 없었다(그 PC 는 개발 로그 서버에 안 붙는다). 그래서 **네이티브 셸을 직접 띄워 재현**했다.

## 재현 방법 — WebView2 에 원격 디버깅을 붙인다

브라우저 모드(Playwright 로 index.html 직접)로는 안 잡힌다 — 문제는 **네이티브 팝업 모드** 전용이었다.
네이티브 셸의 WebView2 는 환경변수로 원격 디버깅을 켤 수 있다:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9333"
Start-Process .\native_host\bin\B2B_NativeHost.exe -WorkingDirectory .
# 이후 playwright: chromium.connect_over_cdp("http://127.0.0.1:9333") → 본창(index.html)·팝업(assist.html) 둘 다 페이지로 잡힌다
```

브리지 함수(`assistSendToPopup` / `assistHandleBridgeMessage` / `assistPostToHost`)를 감싸 양방향 메시지를
기록하고, `page.on("requestfailed")` 로 실패한 URL 을 남기니 원인 세 개가 한 번에 드러났다.
스크립트: 세션 scratch 의 `repro_native_popup_v4.py`(설정·업로드·스킬·적용·진단 프리셋·직접 질문까지 자동).

주의: CDP 로 WebView 팝업 페이지를 `page.close()` 하면 스크립트가 멈춘다 — 앱의 토글
(`assistPostToHost("B2B_ASSIST_POPUP\ttoggle")`)로 닫아야 한다.

## 원인 ① — 팝업 재오픈 때 보관한 질문이 증발 (증상 1)

브리지 로그:

```
main→host  B2B_ASSIST_POPUP\ttoggle
popup→main {"t":"popup-opened"}          ← 'ready' 가 안 온다
```

팝업 페이지는 닫아도 **살아 있다(숨김/표시)**. 그래서 두 번째부터는 `ready` 가 다시 오지 않는다.
그런데 진단 버튼이 보관한 질문(`_assistPendingAsk`)은 `ready` 에서만 보냈고, `popup-opened` 에서는
3초 폴백 타이머까지 지워 버렸다 → 질문이 아무 데도 안 가고 사라진다. 사용자가 본 그대로다.

덤으로 팝업 쪽 `case "ask": if (!busy) submit()` — busy 가 남아 있으면 진단 질문을 **조용히 폐기**했다.

**수정**: `popup-opened` 에서 보관 질문을 보낸다(한 번이라도 ready 였으면 즉시, 아니면 1.5초 폴백 —
첫 로드는 ready 가 먼저 와서 비운다). 팝업은 busy 여도 진단 ask 를 받으면 busy 를 풀고 보낸다
(메인이 새 주제 전환에서 in-flight 를 이미 중단하고 보내므로 안전).

## 원인 ② — 죽은 LLM 주소로 분 단위 매달림 (증상 2 + "스킬 생성 중 오류")

```
reqfail  http://192.168.219.111:8000/v1/models           :: ERR_CONNECTION_TIMED_OUT
reqfail  http://192.168.219.111:8000/v1/chat/completions :: ERR_CONNECTION_TIMED_OUT
console  [B2B#5] 재전송 attempt=2/3 … attempt=3/3
```

개발망 vLLM 이 `.111` → `.108` 로 이전됐는데 `DEFAULTS.devVllm.baseUrl` 이 `.111` 이었다.
연결 타임아웃(~20초) × `/models` 탐색 + 챗 × 3회 재시도 = **라운드마다 1~2분**. AI 도움은 "확인 중…(2)" 에
머물고, 그 사이 `_assistInFlight` 가 true 라 "?" 는 *"이전 요청을 처리 중입니다. 잠시만요."* 로 거절된다.
스킬 생성 채팅도 같은 주소를 쓰니 "스킬 생성 중 오류"가 먼저 났던 것.

`effectiveDevVllmModel` 의 `/models` 탐색 fetch 에는 **타임아웃이 아예 없었다** — 챗 호출 앞단에서 매번
OS 연결 타임아웃을 통째로 먹는 구조.

**수정**: 기본값 `.108`, 저장 설정의 `.111` 은 레거시 목록으로 자동 승격, `/models` 탐색 4초 제한.

## 수정 후 실기 확인(같은 네이티브 팝업 모드, Qwen .108)

- A) 팝업을 열었다 닫은 뒤 진단 버튼 → 3초 안에 질문이 뜨고 도구 5개 돌아 16초에 종료
- B) 팝업에 직접 검산 입력 → 16초, *"결론부터: 같은 금액입니다. 3,797,128,000 / 3,797,128,000
  (합계 행 제외 20행)"* — 멈춤·핸드오프 없음

## 배운 것

1. **"서버가 이사했다"는 앱에서는 "모든 것이 느리게 죽는다"로 보인다.** 오류가 아니라 매달림이라
   사용자는 기능 버그로 보고한다. 바깥 호출에는 반드시 짧은 연결 타임아웃을 두고, 기본 주소는
   레거시 목록으로 승격시켜라(설정 파일이 옛 주소를 물고 있다).
2. **"한 번만 오는 신호"에 상태를 걸지 마라.** `ready` 는 페이지 로드에 한 번이다. 재오픈·본창 새로고침
   등 다른 생명주기에서는 안 온다. 보관 데이터는 도착 가능한 모든 신호에서 비워야 한다.
3. **네이티브 셸도 자동화된다.** `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 한 줄이면 CDP 로 붙는다.
   "네이티브라서 재현 못 한다"는 더는 핑계가 아니다.

관련: `registry.json` 의 `ASSIST-POPUP-REOPEN-PENDING-ASK` / `DEV-VLLM-ENDPOINT-MOVED-HANG`,
`60_assist_silent_failures_chain.md`(같은 날 앞선 네 건).

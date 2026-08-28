---
type: endpoint
title: assistStartFreshTopicForDiagnosis
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "새로 시작한다. 화면의 옛 메시지는 지우지 않고 구분선만 남긴다(사용자는 위로 스크롤해 볼 수 있음)."
role_source: banner
version: "0.8.1"
loc: "assist-ui.js:759-759"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: assist"
raises: []

# ── 유기적 관계 ──
calls:
  - "assistAbortCurrent"
  - "assistAddMsg"
  - "assistIsBusy"
  - "traceClientUiEvent"
calls_external:
  - "isArray"
called_by:
  - "assistOpenAndAsk"
reads:
  - "state.assist"
writes:
  - "assist"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
새로 시작한다. 화면의 옛 메시지는 지우지 않고 구분선만 남긴다(사용자는 위로 스크롤해 볼 수 있음).

## 사이드이펙트 & 주의
- 상태 변경: assist
- 변경 상태 `assist` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `assistAbortCurrent`, `assistAddMsg`, `assistIsBusy`, `traceClientUiEvent`
- 피호출(영향 전파 경로): `assistOpenAndAsk`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

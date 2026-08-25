---
type: endpoint
title: assistPushAssistant
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text, ui)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "assist-core.js:743-743"

# ── 입출력 ──
inputs:
  - "text"
  - "ui"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: assist"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "String"
  - "onAssistantText"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
reads:
  - "state.assist"
writes:
  - "assist"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: assist
- 변경 상태 `assist` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

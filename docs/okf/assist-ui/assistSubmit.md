---
type: endpoint
title: assistSubmit
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text, images)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "assist-ui.js:260-260"

# ── 입출력 ──
inputs:
  - "text"
  - "images"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "assistAddMsg"
  - "assistHandleUserMessage"
  - "assistIsBusy"
  - "assistSetStatus"
calls_external:
  - "finally"
  - "getElementById"
  - "resolve"
  - "setTimeout"
called_by:
  - "assistEnsureDom"
  - "assistOpenAndAsk"
  - "assistRenderChips"
  - "send"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 타이머

## 관계
- 호출: `assistAddMsg`, `assistHandleUserMessage`, `assistIsBusy`, `assistSetStatus`
- 피호출(영향 전파 경로): `assistEnsureDom`, `assistOpenAndAsk`, `assistRenderChips`, `send`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: assistVerifyProposal
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(p, signal)"
role: "[Tier2] 후보 코드를 격리 인스턴스에서 실행해 diff 를 받는다. 실패/불가는 예외가 아니라 결과로."
role_source: banner
version: "0.7.5"
loc: "assist-core.js:975-975"

# ── 입출력 ──
inputs:
  - "p"
  - "signal"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "postExcelMirror"
calls_external:
  - "String"
  - "find"
  - "isArray"
  - "slice"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[Tier2] 후보 코드를 격리 인스턴스에서 실행해 diff 를 받는다. 실패/불가는 예외가 아니라 결과로.

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `postExcelMirror`
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

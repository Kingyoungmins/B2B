---
type: endpoint
title: recoveryExplicitVba
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(function ()"
role: "[사용자 지시] 에러복구에서는 \"실패한 기존 Step 언어\"보다 복구창의 사용자 메모가 우선이다."
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:2993-2993"

# ── 입출력 ──
inputs:
  - "function ("
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "userExplicitlyRequestsPython"
  - "userExplicitlyRequestsVba"
calls_external: []
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[사용자 지시] 에러복구에서는 "실패한 기존 Step 언어"보다 복구창의 사용자 메모가 우선이다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `userExplicitlyRequestsPython`, `userExplicitlyRequestsVba`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

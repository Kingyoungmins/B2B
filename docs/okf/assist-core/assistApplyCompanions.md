---
type: endpoint
title: assistApplyCompanions
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(p, pickedIdx)"
role: "사용자가 승인 버튼을 눌렀을 때만 호출된다. 여기가 유일한 상태 변경 지점."
role_source: banner
version: "0.8.0"
loc: "assist-core.js:1023-1023"

# ── 입출력 ──
inputs:
  - "p"
  - "pickedIdx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "find"
  - "forEach"
  - "includes"
  - "isArray"
called_by:
  - "assistCommitProposal"
reads:
  - "state.chatHistory"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
사용자가 승인 버튼을 눌렀을 때만 호출된다. 여기가 유일한 상태 변경 지점.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistCommitProposal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

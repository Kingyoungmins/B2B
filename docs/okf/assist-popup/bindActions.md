---
type: endpoint
title: bindActions
module: assist-popup.js
lang: js
extraction: regex   # 정규식 근사
signature: "(prefixHtml)"
role: "[검증 항목8] 실패 시 [다시 시도] 버튼을 복원할 수 있게 액션 영역을 재바인딩 함수로 만든다."
role_source: banner
version: "0.7.5"
loc: "assist-popup.js:157-157"

# ── 입출력 ──
inputs:
  - "prefixHtml"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "post"
calls_external:
  - "Number"
  - "String"
  - "filter"
  - "map"
  - "querySelector"
  - "querySelectorAll"
called_by:
  - "assistRenderProposalCard"
  - "onCommitResult"
  - "renderProposal"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[검증 항목8] 실패 시 [다시 시도] 버튼을 복원할 수 있게 액션 영역을 재바인딩 함수로 만든다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `post`
- 피호출(영향 전파 경로): `assistRenderProposalCard`, `onCommitResult`, `renderProposal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

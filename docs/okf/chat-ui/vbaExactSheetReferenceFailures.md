---
type: endpoint
title: vbaExactSheetReferenceFailures
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, sourceUserMessage)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "chat-ui.js:730-730"

# ── 입출력 ──
inputs:
  - "code"
  - "sourceUserMessage"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "exactSheetNamesFromMentions"
  - "push"
  - "vbaSheetReferenceLiterals"
calls_external:
  - "Set"
  - "String"
  - "has"
  - "join"
  - "map"
  - "test"
called_by:
  - "validateAssistantCodeBeforeApply"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `exactSheetNamesFromMentions`, `push`, `vbaSheetReferenceLiterals`
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

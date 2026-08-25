---
type: endpoint
title: _clarifySeparatorWhitespaceQuestion
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text, aoa)"
role: "[따옴표 구분자 공백 불일치 → 되묻기] 사용자가 \"' : ' 뒤 숫자\"처럼 공백 포함 구분자를 따옴표로 지정했는데"
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:3538-3538"

# ── 입출력 ──
inputs:
  - "text"
  - "aoa"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "String"
  - "exec"
  - "indexOf"
  - "min"
  - "slice"
  - "test"
  - "trim"
called_by:
  - "clarifyVerifierAskIfNeeded"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[따옴표 구분자 공백 불일치 → 되묻기] 사용자가 "' : ' 뒤 숫자"처럼 공백 포함 구분자를 따옴표로 지정했는데

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `clarifyVerifierAskIfNeeded`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

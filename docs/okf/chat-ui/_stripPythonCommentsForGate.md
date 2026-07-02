---
type: endpoint
title: _stripPythonCommentsForGate
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "게이트 검사용 주석 제거 — 모델이 프롬프트의 금지 규칙을 주석으로 메아리치는 일이 흔한데"
role_source: banner
version: "0.5.18"
loc: "chat-ui.js:1206-1206"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "join"
  - "map"
  - "slice"
  - "split"
called_by:
  - "pythonComStaticSafetyFailures"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
게이트 검사용 주석 제거 — 모델이 프롬프트의 금지 규칙을 주석으로 메아리치는 일이 흔한데

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `pythonComStaticSafetyFailures`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

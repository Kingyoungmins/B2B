---
type: endpoint
title: assistParseAction
module: assist-guard.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reply)"
role: "응답에서 액션 JSON 을 뽑는다. 3단 폴백(펜스 → 느슨한 펜스 → 중괄호 균형 스캔)."
role_source: banner
version: "0.7.5"
loc: "assist-guard.js:18-18"

# ── 입출력 ──
inputs:
  - "reply"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "parse"
  - "replace"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
응답에서 액션 JSON 을 뽑는다. 3단 폴백(펜스 → 느슨한 펜스 → 중괄호 균형 스캔).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

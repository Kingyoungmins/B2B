---
type: endpoint
title: assistEchoSources
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(sys, tail)"
role: "사용자 메시지는 긴 문단만(soft), 도구 결과(<tool-data>)와 assistant 이전 답은 소스에서 뺀다."
role_source: banner
version: "0.8.4"
loc: "assist-core.js:307-307"

# ── 입출력 ──
inputs:
  - "sys"
  - "tail"
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
  - "test"
called_by:
  - "assistCloseOut"
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
사용자 메시지는 긴 문단만(soft), 도구 결과(<tool-data>)와 assistant 이전 답은 소스에서 뺀다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `assistCloseOut`, `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

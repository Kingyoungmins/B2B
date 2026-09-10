---
type: endpoint
title: _assistResolveSheet
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(f, sname)"
role: "시트명도 같은 규칙으로 — 공백/대소문자/일부 일치가 유일하면 그 이름으로. 아니면 준 그대로(→ unknown_sheet 가 available 을 돌려준다)"
role_source: banner
version: "0.8.4"
loc: "assist-tools.js:200-200"

# ── 입출력 ──
inputs:
  - "f"
  - "sname"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_assistHasSheet"
calls_external:
  - "Set"
  - "String"
  - "filter"
  - "includes"
  - "keys"
  - "lower"
  - "replace"
  - "toLowerCase"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
시트명도 같은 규칙으로 — 공백/대소문자/일부 일치가 유일하면 그 이름으로. 아니면 준 그대로(→ unknown_sheet 가 available 을 돌려준다)

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_assistHasSheet`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

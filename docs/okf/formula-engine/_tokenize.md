---
type: endpoint
title: _tokenize
module: formula-engine.js
lang: js
extraction: regex   # 정규식 근사
signature: "(s)"
role: "----- Tokenizer -----"
role_source: banner
version: "0.5.19"
loc: "formula-engine.js:114-114"

# ── 입출력 ──
inputs:
  - "s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "exec"
  - "indexOf"
  - "parseFloat"
  - "test"
  - "toUpperCase"
called_by:
  - "evalFormula"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
----- Tokenizer -----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `evalFormula`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: _assistParseYamlAction
module: assist-guard.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "반환 형식은 JSON 경로와 동일하며, block 에 '걷어낼 원문 조각'을 정확히 담는다."
role_source: banner
version: "0.8.1"
loc: "assist-guard.js:143-143"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "eat"
calls_external:
  - "String"
  - "apply"
  - "assign"
  - "call"
  - "exec"
  - "includes"
  - "max"
  - "name"
  - "parse"
  - "slice"
  - "test"
  - "toLowerCase"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
반환 형식은 JSON 경로와 동일하며, block 에 '걷어낼 원문 조각'을 정확히 담는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `eat`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

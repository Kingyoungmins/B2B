---
type: endpoint
title: setupDrop
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(zone, input, handler)"
role: "==================================================================="
role_source: banner
version: "0.5.19"
loc: "drop-handling.js:4-4"

# ── 입출력 ──
inputs:
  - "zone"
  - "input"
  - "handler"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
calls_external:
  - "addEventListener"
  - "click"
  - "from"
  - "handler"
  - "preventDefault"
  - "remove"
  - "setAttribute"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
===================================================================

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `add`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

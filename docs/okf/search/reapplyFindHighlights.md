---
type: endpoint
title: reapplyFindHighlights
module: search.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "시뮬레이터가 다시 렌더링되면 강조도 다시 적용"
role_source: banner
version: "0.8.0"
loc: "search.js:136-136"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "runSearch"
calls_external: []
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
시뮬레이터가 다시 렌더링되면 강조도 다시 적용

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `runSearch`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

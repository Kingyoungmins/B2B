---
type: endpoint
title: ensureRowVisible
module: excel-viewer.js
lang: js
extraction: regex   # 정규식 근사
signature: "(rowIdx)"
role: "search.js 가 호출 — 특정 행이 보이도록 가상 스크롤 확장"
role_source: banner
version: "0.8.1"
loc: "excel-viewer.js:887-887"

# ── 입출력 ──
inputs:
  - "rowIdx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "_appendRows"
calls_external:
  - "filter"
  - "forEach"
  - "get"
  - "min"
called_by:
  - "_highlightCurrent"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
search.js 가 호출 — 특정 행이 보이도록 가상 스크롤 확장

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `$`, `_appendRows`
- 피호출(영향 전파 경로): `_highlightCurrent`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

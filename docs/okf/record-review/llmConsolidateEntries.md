---
type: endpoint
title: llmConsolidateEntries
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(entries)"
role: "결과가 완전히 같을 때만 통합본을 돌려주므로(다르면 원본), 순서·값이 꼬이지 않는다."
role_source: banner
version: "0.8.0"
loc: "record-review.js:337-337"

# ── 입출력 ──
inputs:
  - "entries"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "postExcelMirror"
calls_external:
  - "all"
  - "async"
  - "isArray"
  - "map"
  - "match"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
결과가 완전히 같을 때만 통합본을 돌려주므로(다르면 원본), 순서·값이 꼬이지 않는다.

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `postExcelMirror`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

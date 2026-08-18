---
type: endpoint
title: runnerRefreshUnreliableSheetNames
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[진짜 시트명 재확보] 업로드 순간 Excel 이 바빠서 검사에 실패한 워크북은 시트 목록이 '파일명'"
role_source: banner
version: "0.7.4"
loc: "drop-handling.js:1734-1734"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "concat"
  - "fetch"
  - "filter"
  - "forEach"
  - "isArray"
  - "json"
  - "map"
  - "slice"
  - "stringify"
called_by: []
reads:
  - "state.inputs"
  - "state.inputsOriginal"
  - "state.outputTemplates"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[진짜 시트명 재확보] 업로드 순간 Excel 이 바빠서 검사에 실패한 워크북은 시트 목록이 '파일명'

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

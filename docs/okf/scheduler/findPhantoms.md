---
type: endpoint
title: findPhantoms
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "(data, required, steps)"
role: "②③ 덕분에 '이름만 잘못 적힌 참조'(예: 확장자 중복)는 유령으로 오해되지 않는다."
role_source: banner
version: "0.8.1"
loc: "scheduler.js:117-117"

# ── 입출력 ──
inputs:
  - "data"
  - "required"
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "base"
  - "codeLiterals"
calls_external:
  - "Map"
  - "Set"
  - "filter"
  - "forEach"
  - "get"
  - "has"
  - "map"
  - "set"
  - "slice"
  - "startsWith"
called_by:
  - "analyze"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
②③ 덕분에 '이름만 잘못 적힌 참조'(예: 확장자 중복)는 유령으로 오해되지 않는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `base`, `codeLiterals`
- 피호출(영향 전파 경로): `analyze`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

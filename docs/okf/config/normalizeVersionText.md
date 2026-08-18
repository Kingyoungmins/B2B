---
type: endpoint
title: normalizeVersionText
module: config.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "versionTest.normalize_version)와 같은 규칙 — 한쪽만 바꾸면 안 된다."
role_source: banner
version: "0.7.4"
loc: "config.js:144-144"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "concat"
  - "every"
  - "filter"
  - "join"
  - "map"
  - "parseInt"
  - "replace"
  - "slice"
  - "split"
  - "test"
  - "trim"
called_by:
  - "runVersionCheck"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
versionTest.normalize_version)와 같은 규칙 — 한쪽만 바꾸면 안 된다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `runVersionCheck`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

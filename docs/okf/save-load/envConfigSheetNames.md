---
type: endpoint
title: envConfigSheetNames
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(file)"
role: "(envConfig 필터가 length 로 게이트한다) 스킬에 적힌 진짜 시트명이 그대로 쓰인다."
role_source: banner
version: "0.7.4"
loc: "save-load.js:243-243"

# ── 입출력 ──
inputs:
  - "file"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "isArray"
called_by:
  - "_buildLogicZipEntriesImpl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(envConfig 필터가 length 로 게이트한다) 스킬에 적힌 진짜 시트명이 그대로 쓰인다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_buildLogicZipEntriesImpl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

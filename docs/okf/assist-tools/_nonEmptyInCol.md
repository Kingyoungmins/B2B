---
type: endpoint
title: _nonEmptyInCol
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(idx)"
role: "[중복 헤더 개선] 같은 이름 헤더가 여러 열이면(예: 템플릿의 빈 '회사' A열 + 붙여넣은 '회사' D열)"
role_source: banner
version: "0.8.1"
loc: "assist-tools.js:270-270"

# ── 입출력 ──
inputs:
  - "idx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "_pickBestCol"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[중복 헤더 개선] 같은 이름 헤더가 여러 열이면(예: 템플릿의 빈 '회사' A열 + 붙여넣은 '회사' D열)

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_pickBestCol`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

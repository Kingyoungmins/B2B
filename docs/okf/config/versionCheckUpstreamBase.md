---
type: endpoint
title: versionCheckUpstreamBase
module: config.js
lang: js
extraction: regex   # 정규식 근사
signature: "(raw)"
role: "(versionTest/main.py 는 /version 과 /v1/version 을 모두 받는다 — curl 로도 그대로 확인 가능)"
role_source: banner
version: "0.7.4"
loc: "config.js:115-115"

# ── 입출력 ──
inputs:
  - "raw"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "replace"
  - "trim"
called_by:
  - "saveVersionCheckSettings"
  - "versionCheckUpstreamEndpoint"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(versionTest/main.py 는 /version 과 /v1/version 을 모두 받는다 — curl 로도 그대로 확인 가능)

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `saveVersionCheckSettings`, `versionCheckUpstreamEndpoint`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

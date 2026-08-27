---
type: endpoint
title: runnerCurrentMappingSignature
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[매핑 보존] 시그니처는 '어떤 파일이 올라와 있나 + 어떤 스킬이 로드돼 있나'만 본다."
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:1516-1516"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "runnerMappingKnownFiles"
calls_external:
  - "join"
  - "map"
  - "stringify"
called_by:
  - "collectSoftRefreshSnapshot"
  - "restoreSoftRefreshSnapshot"
  - "runnerResetMappingIfSourceChanged"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[매핑 보존] 시그니처는 '어떤 파일이 올라와 있나 + 어떤 스킬이 로드돼 있나'만 본다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `runnerMappingKnownFiles`
- 피호출(영향 전파 경로): `collectSoftRefreshSnapshot`, `restoreSoftRefreshSnapshot`, `runnerResetMappingIfSourceChanged`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

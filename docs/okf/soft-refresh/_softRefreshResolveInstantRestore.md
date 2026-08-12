---
type: endpoint
title: _softRefreshResolveInstantRestore
module: soft-refresh.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "사본이 없는 경우(엔진이 안 남겼거나·정리로 지워졌거나·스킬/파일이 달라짐)는 전부 여기서 \"\"가 된다."
role_source: banner
version: "0.7.3"
loc: "soft-refresh.js:128-128"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "pipelineLiveStateSig"
  - "push"
calls_external:
  - "fetch"
  - "forEach"
  - "includes"
  - "info"
  - "isArray"
  - "json"
  - "stringify"
  - "warn"
called_by:
  - "restoreSoftRefreshSnapshot"
reads:
  - "state.inputs"
  - "state.outputTemplates"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
사본이 없는 경우(엔진이 안 남겼거나·정리로 지워졌거나·스킬/파일이 달라짐)는 전부 여기서 ""가 된다.

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `pipelineLiveStateSig`, `push`
- 피호출(영향 전파 경로): `restoreSoftRefreshSnapshot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

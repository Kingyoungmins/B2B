---
type: endpoint
title: runVersionCheck
module: config.js
lang: js
extraction: regex   # 정규식 근사
signature: "(cfg)"
role: "upstreamUrl 은 버전 서버가 실제로 받은 완성 주소 — 그대로 curl 로 확인할 수 있다."
role_source: banner
version: "0.7.3"
loc: "config.js:155-155"

# ── 입출력 ──
inputs:
  - "cfg"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "loadVersionCheckSettings"
  - "normalizeVersionText"
  - "openAICompatAuthHeaders"
  - "versionCheckUpstreamEndpoint"
calls_external:
  - "Error"
  - "String"
  - "fetch"
  - "json"
  - "parse"
  - "replace"
  - "slice"
  - "split"
  - "stringify"
  - "text"
  - "trim"
  - "txt"
called_by:
  - "openSettingsModal"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
upstreamUrl 은 버전 서버가 실제로 받은 완성 주소 — 그대로 curl 로 확인할 수 있다.

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `loadVersionCheckSettings`, `normalizeVersionText`, `openAICompatAuthHeaders`, `versionCheckUpstreamEndpoint`
- 피호출(영향 전파 경로): `openSettingsModal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

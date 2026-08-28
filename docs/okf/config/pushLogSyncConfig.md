---
type: endpoint
title: pushLogSyncConfig
module: config.js
lang: js
extraction: regex   # 정규식 근사
signature: "(conf)"
role: "화면이 뜰 때 한 번, 설정을 저장할 때마다 백엔드에 알려 준다. 실패는 무시한다(부가 기능)."
role_source: banner
version: "0.8.1"
loc: "config.js:133-133"

# ── 입출력 ──
inputs:
  - "conf"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "loadVersionCheckSettings"
calls_external:
  - "fetch"
  - "stringify"
called_by:
  - "saveVersionCheckSettings"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
화면이 뜰 때 한 번, 설정을 저장할 때마다 백엔드에 알려 준다. 실패는 무시한다(부가 기능).

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `loadVersionCheckSettings`
- 피호출(영향 전파 경로): `saveVersionCheckSettings`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: function
title: _note_network_failure
module: secure_doc.py
lang: python
extraction: ast
signature: "(what)"
role: "네트워크 무응답 실패 직후 30초(프로브 캐시)간 보안 호출을 쉬게 한다."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:160-174"

# ── 입출력 ──
inputs:
  - "what"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "time"
called_by:
  - "_post_drm"
reads:
  - "PROBE_CACHE_SECONDS"
  - "_LOCK"
  - "_STATE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
네트워크 무응답 실패 직후 30초(프로브 캐시)간 보안 호출을 쉬게 한다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _STATE
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_post_drm`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

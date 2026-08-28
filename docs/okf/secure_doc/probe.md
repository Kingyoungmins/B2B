---
type: function
title: probe
module: secure_doc.py
lang: python
extraction: ast
signature: "(force=False)"
role: "릴레이 서버의 DRM 설정 상태(/v1/drm/health). 실패/미설정이면 기능이 조용히 꺼진 것처럼 동작."
role_source: docstring
version: "0.8.1"
loc: "secure_doc.py:129-153"

# ── 입출력 ──
inputs:
  - "force"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
  - "상태 변경(전역/세션): _STATE"
raises: []

# ── 유기적 관계 ──
calls:
  - "_headers"
  - "config"
  - "read"
calls_external:
  - "Request"
  - "bool"
  - "cfg"
  - "decode"
  - "err"
  - "get"
  - "loads"
  - "req"
  - "time"
  - "type"
  - "urlopen"
called_by:
  - "available"
  - "status"
reads:
  - "PROBE_CACHE_SECONDS"
  - "_LOCK"
  - "_STATE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
릴레이 서버의 DRM 설정 상태(/v1/drm/health). 실패/미설정이면 기능이 조용히 꺼진 것처럼 동작.

## 사이드이펙트 & 주의
- 네트워크 호출
- 상태 변경(전역/세션): _STATE
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_headers`, `config`, `read`
- 피호출(영향 전파 경로): `available`, `status`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

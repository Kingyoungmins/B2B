---
type: function
title: _ensure_user
module: log_sync.py
lang: python
extraction: ast
signature: "()"
role: "사용자명을 워커 스레드에서 뒤늦게 구한다(시작 경로를 막지 않으려고)."
role_source: docstring
version: "0.8.2"
loc: "log_sync.py:508-520"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
raises: []

# ── 유기적 관계 ──
calls:
  - "current_user"
calls_external:
  - "get"
called_by:
  - "tick"
reads:
  - "_LOCK"
  - "_STATE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
사용자명을 워커 스레드에서 뒤늦게 구한다(시작 경로를 막지 않으려고).

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _STATE
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `current_user`
- 피호출(영향 전파 경로): `tick`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

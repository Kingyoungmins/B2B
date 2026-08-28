---
type: function
title: _note_fail
module: log_sync.py
lang: python
extraction: ast
signature: "(err)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "log_sync.py:258-262"

# ── 입출력 ──
inputs:
  - "err"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "err"
  - "type"
called_by:
  - "_ensure_session"
  - "_send_log_file"
  - "_send_skill"
  - "stop"
  - "tick"
reads:
  - "_LOCK"
  - "_STATE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _STATE
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_ensure_session`, `_send_log_file`, `_send_skill`, `stop`, `tick`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

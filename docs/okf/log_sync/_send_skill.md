---
type: function
title: _send_skill
module: log_sync.py
lang: python
extraction: ast
signature: "(path, timeout=20.0, deadline=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "log_sync.py:434-459"

# ── 입출력 ──
inputs:
  - "path"
  - "timeout"
  - "deadline"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_as_result"
  - "_encode"
  - "_note_fail"
  - "_note_ok"
  - "_post"
calls_external:
  - "RuntimeError"
  - "blob"
  - "err"
  - "fromtimestamp"
  - "get"
  - "isoformat"
  - "len"
  - "path"
  - "read_bytes"
  - "result"
  - "stat"
  - "str"
  - "timeout"
called_by:
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
- 파일시스템 변경/IO
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_as_result`, `_encode`, `_note_fail`, `_note_ok`, `_post`
- 피호출(영향 전파 경로): `tick`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

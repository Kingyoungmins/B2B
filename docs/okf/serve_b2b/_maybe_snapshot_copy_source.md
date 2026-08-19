---
type: function
title: _maybe_snapshot_copy_source
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app)"
role: "복사(Ctrl+C)로 CutCopyMode 가 켜져 있는 동안 클립보드 소스를 전역 스냅샷에 저장한다."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:10883-10912"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): LAST_COPY_SOURCE"
raises: []

# ── 유기적 관계 ──
calls:
  - "_read_excel_clipboard_source"
calls_external:
  - "bool"
  - "float"
  - "get"
  - "monotonic"
called_by:
  - "_poll_excel_session_changes_impl"
reads:
  - "COPY_SOURCE_SNAPSHOT_THROTTLE_SECONDS"
  - "LAST_COPY_SOURCE"
writes:
  - "LAST_COPY_SOURCE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
복사(Ctrl+C)로 CutCopyMode 가 켜져 있는 동안 클립보드 소스를 전역 스냅샷에 저장한다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): LAST_COPY_SOURCE
- 변경 상태 `LAST_COPY_SOURCE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_read_excel_clipboard_source`
- 피호출(영향 전파 경로): `_poll_excel_session_changes_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

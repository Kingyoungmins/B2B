---
type: function
title: _read_excel_clipboard_source
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "Windows 클립보드의 Excel 'Link' 포맷에서 복사 소스(워크북/시트/범위)를 역추적한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:10805-10873"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_r1c1_to_a1"
  - "range"
calls_external:
  - "CloseClipboard"
  - "EnumClipboardFormats"
  - "GetClipboardData"
  - "GetClipboardFormatName"
  - "OpenClipboard"
  - "bytes"
  - "data"
  - "decode"
  - "enc"
  - "f"
  - "group"
  - "isinstance"
  - "len"
  - "parts"
  - "search"
  - "sleep"
  - "split"
  - "str"
  - "strip"
called_by:
  - "_capture_copypaste_on_session_impl"
  - "_maybe_snapshot_copy_source"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
Windows 클립보드의 Excel 'Link' 포맷에서 복사 소스(워크북/시트/범위)를 역추적한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_r1c1_to_a1`, `range`
- 피호출(영향 전파 경로): `_capture_copypaste_on_session_impl`, `_maybe_snapshot_copy_source`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

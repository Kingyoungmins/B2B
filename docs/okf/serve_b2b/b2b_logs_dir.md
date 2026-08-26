---
type: function
title: b2b_logs_dir
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "트레이스 로그 저장 폴더 — 프로즌/개발 무관하게 항상 %LOCALAPPDATA%\\B2B_logs 로 고정."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:312-322"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "base"
  - "get"
  - "home"
  - "mkdir"
  - "str"
called_by:
  - "_perf_trace_path"
  - "_start_log_sync"
  - "_vba_trace_path"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
트레이스 로그 저장 폴더 — 프로즌/개발 무관하게 항상 %LOCALAPPDATA%\B2B_logs 로 고정.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_perf_trace_path`, `_start_log_sync`, `_vba_trace_path`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

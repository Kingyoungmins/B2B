---
type: function
title: _reset_trace_logs
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "프로그램 시작 시 이전 실행의 트레이스 로그를 비운다(누적 방지). 저장 위치는 %LOCALAPPDATA%\\B2B_logs."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:8714-8731"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_perf_trace_path"
  - "_vba_trace_path"
calls_external:
  - "Path"
  - "__file__"
  - "exists"
  - "mkdir"
  - "open"
  - "p"
  - "resolve"
called_by:
  - "start_runtime_maintenance_threads"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
프로그램 시작 시 이전 실행의 트레이스 로그를 비운다(누적 방지). 저장 위치는 %LOCALAPPDATA%\B2B_logs.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_perf_trace_path`, `_vba_trace_path`
- 피호출(영향 전파 경로): `start_runtime_maintenance_threads`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

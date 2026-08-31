---
type: function
title: _addon_telemetry_init
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "기동 시 1회(멱등). 두 진입점(launch_b2b.py / python serve_b2b.py)이 모두"
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:5531-5543"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_current_app_version"
  - "_perf_trace"
  - "init"
  - "writable_app_dir"
calls_external:
  - "bool"
  - "get"
  - "list"
  - "str"
  - "strip"
  - "ver"
called_by:
  - "start_runtime_maintenance_threads"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
기동 시 1회(멱등). 두 진입점(launch_b2b.py / python serve_b2b.py)이 모두

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_current_app_version`, `_perf_trace`, `init`, `writable_app_dir`
- 피호출(영향 전파 경로): `start_runtime_maintenance_threads`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

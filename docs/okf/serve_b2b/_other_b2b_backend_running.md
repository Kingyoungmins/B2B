---
type: function
title: _other_b2b_backend_running
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "현재 프로세스 외 다른 B2B 백엔드(B2B_Server.exe 또는 serve_b2b.py python)가 살아있는지."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:527-565"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
calls_external:
  - "Process"
  - "children"
  - "get"
  - "getpid"
  - "getppid"
  - "join"
  - "lower"
  - "me"
  - "process_iter"
  - "startswith"
called_by:
  - "cleanup_stale_temp_artifacts"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
현재 프로세스 외 다른 B2B 백엔드(B2B_Server.exe 또는 serve_b2b.py python)가 살아있는지.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`
- 피호출(영향 전파 경로): `cleanup_stale_temp_artifacts`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

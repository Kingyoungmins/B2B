---
type: function
title: cleanup_stale_temp_artifacts
module: serve_b2b.py
lang: python
extraction: ast
signature: "(min_age_seconds=300, excel_diag_max_age_seconds=86400, mei_max_age_seconds=86400)"
role: "[디스크 누수 방지] 앱 시작 시 이전 실행(크래시/강제종료 포함)이 남긴 임시 작업물을 정리한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:598-757"

# ── 입출력 ──
inputs:
  - "min_age_seconds"
  - "excel_diag_max_age_seconds"
  - "mei_max_age_seconds"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_is_pid_alive"
  - "_other_b2b_backend_running"
  - "_vba_trace"
calls_external:
  - "Path"
  - "_age_ok"
  - "_is_self"
  - "_rm"
  - "any"
  - "bool"
  - "child"
  - "d"
  - "excel_diag_max_age_seconds"
  - "exists"
  - "float"
  - "getattr"
  - "gettempdir"
  - "glob"
  - "int"
  - "is_dir"
  - "is_file"
  - "iterdir"
  - "lower"
  - "mei_max_age_seconds"
  - "min_age"
  - "min_age_seconds"
  - "other_backend"
  - "p"
  - "pat"
  - "pfx"
  - "pr"
  - "resolve"
  - "rglob"
  - "rmtree"
  - "round"
  - "rsplit"
  - "startswith"
  - "stat"
  - "str"
  - "sys"
  - "time"
  - "unlink"
  - "wv_pid"
called_by:
  - "start_runtime_maintenance_threads"
reads:
  - "BACKEND_DIR"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[디스크 누수 방지] 앱 시작 시 이전 실행(크래시/강제종료 포함)이 남긴 임시 작업물을 정리한다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_is_pid_alive`, `_other_b2b_backend_running`, `_vba_trace`
- 피호출(영향 전파 경로): `start_runtime_maintenance_threads`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

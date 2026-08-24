---
type: function
title: _start_log_sync
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "로그/스킬을 수집 서버(versionTest)로 자동 전송 시작."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:4934-4958"

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
  - "b2b_logs_dir"
  - "logic_backup_dir"
  - "writable_app_dir"
calls_external:
  - "Path"
  - "__file__"
  - "get"
  - "resolve"
  - "start"
  - "str"
called_by:
  - "start_runtime_maintenance_threads"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
로그/스킬을 수집 서버(versionTest)로 자동 전송 시작.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_current_app_version`, `b2b_logs_dir`, `logic_backup_dir`, `writable_app_dir`
- 피호출(영향 전파 경로): `start_runtime_maintenance_threads`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

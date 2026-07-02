---
type: function
title: run_python_on_session
module: serve_b2b.py
lang: python
extraction: ast
signature: "(excel_id, code)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:10464-10481"

# ── 입출력 ──
inputs:
  - "excel_id"
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "_force_restart_excel_sessions_direct"
  - "_run_python_on_session_impl"
  - "_vba_trace"
  - "excel_call"
calls_external:
  - "PY_SKILL_TIMEOUT_S"
  - "RuntimeError"
  - "code"
  - "err"
  - "excel_id"
  - "int"
  - "max"
  - "str"
  - "timeout"
called_by:
  - "B2BHandler.handle_excel_run_python"
reads:
  - "PY_SKILL_TIMEOUT_S"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_force_restart_excel_sessions_direct`, `_run_python_on_session_impl`, `_vba_trace`, `excel_call`
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_run_python`

## 실패/예외
- `RuntimeError`

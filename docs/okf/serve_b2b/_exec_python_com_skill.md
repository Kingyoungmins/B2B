---
type: function
title: _exec_python_com_skill
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb, session, code, skip_static=False, timeout_s=None)"
role: "샌드박스 exec + 데드라인 트레이서로 생성 Python 스킬을 실행한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:14295-14378"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
  - "session"
  - "code"
  - "skip_static"
  - "timeout_s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "PythonComSkillError"
  - "err"

# ── 유기적 관계 ──
calls:
  - "_changed"
  - "_py_skill_deadline"
  - "_python_com_static_check"
  - "_rollback"
  - "_vba_trace"
  - "summary"
calls_external:
  - "PY_SKILL_ENTRY"
  - "PythonComSkillContext"
  - "PythonComSkillError"
  - "_PY_SAFE_BUILTINS"
  - "_tracer"
  - "_w_total"
  - "app"
  - "callable"
  - "code"
  - "compile"
  - "ctx"
  - "dict"
  - "err"
  - "exec"
  - "fn"
  - "get"
  - "int"
  - "monotonic"
  - "safe_globals"
  - "session"
  - "settrace"
  - "str"
  - "timeout_s"
  - "wb"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_verify_step_isolated_impl"
reads:
  - "PY_SKILL_ENTRY"
  - "_PY_SAFE_BUILTINS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
샌드박스 exec + 데드라인 트레이서로 생성 Python 스킬을 실행한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_changed`, `_py_skill_deadline`, `_python_com_static_check`, `_rollback`, `_vba_trace`, `summary`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_pipeline_on_session_impl`, `_verify_step_isolated_impl`

## 실패/예외
- `PythonComSkillError`
- `err`

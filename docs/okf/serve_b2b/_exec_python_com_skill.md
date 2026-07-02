---
type: function
title: _exec_python_com_skill
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, wb, session, code, skip_static=False)"
role: "샌드박스 exec + 데드라인 트레이서로 생성 Python 스킬을 실행한다."
role_source: docstring
version: "0.5.18"
loc: "serve_b2b.py:10428-10484"

# ── 입출력 ──
inputs:
  - "app"
  - "wb"
  - "session"
  - "code"
  - "skip_static"
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
  - "_python_com_static_check"
  - "_rollback"
  - "summary"
calls_external:
  - "PY_SKILL_ENTRY"
  - "PythonComSkillContext"
  - "PythonComSkillError"
  - "_PY_SAFE_BUILTINS"
  - "_tracer"
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
  - "monotonic"
  - "safe_globals"
  - "session"
  - "settrace"
  - "str"
  - "wb"
called_by:
  - "_run_excel_python_pipeline_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_python_on_session_impl"
  - "_run_vba_pipeline_on_session_impl"
reads:
  - "PY_SKILL_ENTRY"
  - "PY_SKILL_TIMEOUT_S"
  - "_PY_SAFE_BUILTINS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
샌드박스 exec + 데드라인 트레이서로 생성 Python 스킬을 실행한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_changed`, `_python_com_static_check`, `_rollback`, `summary`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`, `_run_full_pipeline_single_instance_impl`, `_run_python_on_session_impl`, `_run_vba_pipeline_on_session_impl`

## 실패/예외
- `PythonComSkillError`
- `err`

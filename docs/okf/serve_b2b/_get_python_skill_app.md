---
type: function
title: _get_python_skill_app
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:19190-19219"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "상태 변경(전역/세션): PYTHON_SKILL_APP, PYTHON_SKILL_APP_LAST_USED, PYTHON_SKILL_APP_PID"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_process_id"
  - "_hide_excel_app_window"
  - "_perf_trace"
  - "_track_spawned_excel_app"
  - "value"
calls_external:
  - "DispatchEx"
  - "PYTHON_SKILL_APP_PID"
  - "app"
  - "attr"
  - "setattr"
  - "time"
called_by:
  - "_run_excel_python_pipeline_impl"
reads:
  - "PYTHON_SKILL_APP"
  - "PYTHON_SKILL_APP_PID"
writes:
  - "PYTHON_SKILL_APP"
  - "PYTHON_SKILL_APP_LAST_USED"
  - "PYTHON_SKILL_APP_PID"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 상태 변경(전역/세션): PYTHON_SKILL_APP, PYTHON_SKILL_APP_LAST_USED, PYTHON_SKILL_APP_PID
- 변경 상태 `PYTHON_SKILL_APP, PYTHON_SKILL_APP_LAST_USED, PYTHON_SKILL_APP_PID` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_excel_process_id`, `_hide_excel_app_window`, `_perf_trace`, `_track_spawned_excel_app`, `value`
- 피호출(영향 전파 경로): `_run_excel_python_pipeline_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

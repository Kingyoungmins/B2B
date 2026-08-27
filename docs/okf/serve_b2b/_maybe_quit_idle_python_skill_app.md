---
type: function
title: _maybe_quit_idle_python_skill_app
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "Run only on the Excel COM STA worker. Do not call from HTTP threads."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:19601-19620"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): PYTHON_SKILL_APP_REAP_CHECK_AT"
raises: []

# ── 유기적 관계 ──
calls:
  - "_perf_trace"
  - "_quit_python_skill_app"
calls_external:
  - "PYTHON_SKILL_APP_IDLE_TTL_SECONDS"
  - "float"
  - "pid"
  - "round"
  - "time"
called_by:
  - "ensure_excel_worker"
reads:
  - "PYTHON_SKILL_APP"
  - "PYTHON_SKILL_APP_IDLE_TTL_SECONDS"
  - "PYTHON_SKILL_APP_LAST_USED"
  - "PYTHON_SKILL_APP_PID"
  - "PYTHON_SKILL_APP_REAP_CHECK_AT"
writes:
  - "PYTHON_SKILL_APP_REAP_CHECK_AT"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Run only on the Excel COM STA worker. Do not call from HTTP threads.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): PYTHON_SKILL_APP_REAP_CHECK_AT
- 변경 상태 `PYTHON_SKILL_APP_REAP_CHECK_AT` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_perf_trace`, `_quit_python_skill_app`
- 피호출(영향 전파 경로): `ensure_excel_worker`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

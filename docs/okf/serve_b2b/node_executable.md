---
type: function
title: node_executable
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:269-274"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "app_base_dir"
calls_external:
  - "bundled"
  - "exists"
  - "str"
  - "which"
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.handle_backend_pipeline_run"
  - "ensure_node_worker"
  - "run_js_pipeline_with_node"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `app_base_dir`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.handle_backend_pipeline_run`, `ensure_node_worker`, `run_js_pipeline_with_node`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

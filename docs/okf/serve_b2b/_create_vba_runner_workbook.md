---
type: function
title: _create_vba_runner_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, context_wb)"
role: "Create a local temporary .xlsm workbook used only to host injected VBA."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:9014-9075"

# ── 입출력 ──
inputs:
  - "app"
  - "context_wb"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_b2b_runner_trusted_dir"
calls_external:
  - "Activate"
  - "Add"
  - "Close"
  - "Path"
  - "SaveAs"
  - "Windows"
  - "_runner_base"
  - "mkdtemp"
  - "rmtree"
  - "str"
  - "temp_dir"
  - "temp_path"
  - "uuid4"
called_by:
  - "_run_vba_via_runner_with_retry"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
Create a local temporary .xlsm workbook used only to host injected VBA.

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)
- 파일시스템 변경/IO

## 관계
- 호출: `_b2b_runner_trusted_dir`
- 피호출(영향 전파 경로): `_run_vba_via_runner_with_retry`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: function
title: _close_vba_runner_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app, runner_wb, temp_dir)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:9219-9239"

# ── 입출력 ──
inputs:
  - "app"
  - "runner_wb"
  - "temp_dir"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Close"
  - "rmtree"
  - "temp_dir"
called_by:
  - "_run_vba_via_runner_with_retry"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_run_vba_via_runner_with_retry`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

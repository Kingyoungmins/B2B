---
type: function
title: _excel_grid_hwnds_for_pid
module: serve_b2b.py
lang: python
extraction: ast
signature: "(pid)"
role: "해당 pid 의 XLMAIN 최상위 창 아래 EXCEL7(그리드) 자식 hwnd 목록 — 셀 편집 확정 키 전송 대상."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:5485-5517"

# ── 입출력 ──
inputs:
  - "pid"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "EnumChildWindows"
  - "EnumWindows"
  - "GetClassName"
  - "GetWindowThreadProcessId"
  - "_child"
  - "_top"
  - "ch"
  - "hwnd"
  - "int"
  - "pid"
  - "wpid"
called_by:
  - "_commit_pending_excel_cell_edit"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
해당 pid 의 XLMAIN 최상위 창 아래 EXCEL7(그리드) 자식 hwnd 목록 — 셀 편집 확정 키 전송 대상.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `_commit_pending_excel_cell_edit`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

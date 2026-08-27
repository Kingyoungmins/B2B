---
type: function
title: _same_excel_app
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app_a, app_b)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:6996-6999"

# ── 입출력 ──
inputs:
  - "app_a"
  - "app_b"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_excel_app_hwnd"
calls_external:
  - "app_a"
  - "app_b"
  - "bool"
called_by:
  - "PythonComSkillContext.copy_sheet"
  - "_hide_peer_workbook_windows"
  - "_session_for_workbook"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_excel_app_hwnd`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy_sheet`, `_hide_peer_workbook_windows`, `_session_for_workbook`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

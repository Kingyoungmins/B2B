---
type: function
title: _same_excel_workbook
module: serve_b2b.py
lang: python
extraction: ast
signature: "(a, b)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:6940-6951"

# ── 입출력 ──
inputs:
  - "a"
  - "b"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "a"
  - "attr"
  - "b"
  - "getattr"
  - "lower"
  - "str"
called_by:
  - "_capture_live_view_state"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_capture_live_view_state`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

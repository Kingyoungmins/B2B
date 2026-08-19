---
type: function
title: _browser_content_rect
module: serve_b2b.py
lang: python
extraction: ast
signature: "(browser_hwnd)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:3810-3812"

# ── 입출력 ──
inputs:
  - "browser_hwnd"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_browser_content_target"
calls_external:
  - "browser_hwnd"
called_by:
  - "_resolve_excel_mirror_rect"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_browser_content_target`
- 피호출(영향 전파 경로): `_resolve_excel_mirror_rect`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

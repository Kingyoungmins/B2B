---
type: method
title: ExcelWorkbookProxy.display_value
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorkbookProxy
signature: "(self, sheet_or_name, row, col)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:15246-15247"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_or_name"
  - "row"
  - "col"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "col"
  - "row"
calls_external:
  - "self"
  - "sheet_or_name"
called_by: []
reads:
  - "self._ctx"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `col`, `row`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

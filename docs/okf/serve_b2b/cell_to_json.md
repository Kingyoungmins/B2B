---
type: function
title: cell_to_json
module: serve_b2b.py
lang: python
extraction: ast
signature: "(value)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:19552-19557"

# ── 입출력 ──
inputs:
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "value"
calls_external:
  - "hasattr"
  - "isoformat"
called_by:
  - "_excel_output_preview_sheets"
  - "inspect_workbook"
  - "inspect_workbook_with_excel"
  - "load_workbook_aoa"
  - "load_workbook_aoa_with_excel"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `value`
- 피호출(영향 전파 경로): `_excel_output_preview_sheets`, `inspect_workbook`, `inspect_workbook_with_excel`, `load_workbook_aoa`, `load_workbook_aoa_with_excel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

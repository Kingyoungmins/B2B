---
type: method
title: OpenpyxlWorksheetProxy.insert_cols
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlWorksheetProxy
signature: "(self, idx, amount=1)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:16857-16866"

# ── 입출력 ──
inputs:
  - "self"
  - "idx"
  - "amount"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_formula_cells"
  - "_write_translated_formula"
  - "col"
  - "flush_pending_rows"
  - "row"
calls_external:
  - "amount"
  - "formula"
  - "idx"
  - "int"
  - "max"
called_by:
  - "PythonComSkillContext.move_cols"
  - "PythonComSkillContext.split_column"
reads:
  - "self._formula_cells"
  - "self._write_translated_formula"
  - "self._ws"
  - "self.flush_pending_rows"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_formula_cells`, `_write_translated_formula`, `col`, `flush_pending_rows`, `row`
- 피호출(영향 전파 경로): `PythonComSkillContext.move_cols`, `PythonComSkillContext.split_column`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

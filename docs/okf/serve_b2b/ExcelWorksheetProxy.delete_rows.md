---
type: method
title: ExcelWorksheetProxy.delete_rows
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorksheetProxy
signature: "(self, idx, amount=1)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:15498-15502"

# ── 입출력 ──
inputs:
  - "self"
  - "idx"
  - "amount"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "Range"
  - "Rows"
calls_external:
  - "Delete"
  - "idx"
  - "int"
  - "max"
called_by:
  - "OpenpyxlWorksheetProxy.clear"
  - "PythonComSkillContext.dedupe"
reads:
  - "self._worksheet"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `Range`, `Rows`
- 피호출(영향 전파 경로): `OpenpyxlWorksheetProxy.clear`, `PythonComSkillContext.dedupe`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

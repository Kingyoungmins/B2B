---
type: method
title: ExcelSkillContext.input
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelSkillContext
signature: "(self, hint=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:11384-11389"

# ── 입출력 ──
inputs:
  - "self"
  - "hint"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "values"
  - "workbook_like"
calls_external:
  - "RuntimeError"
  - "hint"
  - "iter"
  - "len"
  - "next"
called_by: []
reads:
  - "self.inputs"
  - "self.workbook_like"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `values`, `workbook_like`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `RuntimeError`

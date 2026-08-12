---
type: method
title: OpenpyxlSkillContext._cached_ws_for
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self, ws)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:17116-17124"

# ── 입출력 ──
inputs:
  - "self"
  - "ws"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_get_output_cached_wb"
calls_external:
  - "getattr"
  - "ws"
called_by:
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.value"
reads:
  - "self._get_output_cached_wb"
  - "self._workbook"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_get_output_cached_wb`
- 피호출(영향 전파 경로): `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.value`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

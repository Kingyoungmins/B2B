---
type: method
title: OpenpyxlSkillContext._get_output_cached_wb
module: serve_b2b.py
lang: python
extraction: ast
class: OpenpyxlSkillContext
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:13462-13470"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self._output_cached_tried, self._output_cached_wb"
raises: []

# ── 유기적 관계 ──
calls:
  - "openpyxl_load_workbook_compatible"
calls_external:
  - "Path"
called_by:
  - "OpenpyxlSkillContext._cached_ws_for"
reads:
  - "self._output_cached_path"
  - "self._output_cached_tried"
  - "self._output_cached_wb"
writes:
  - "self._output_cached_tried"
  - "self._output_cached_wb"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self._output_cached_tried, self._output_cached_wb
- 변경 상태 `self._output_cached_tried, self._output_cached_wb` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `openpyxl_load_workbook_compatible`
- 피호출(영향 전파 경로): `OpenpyxlSkillContext._cached_ws_for`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

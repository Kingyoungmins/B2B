---
type: function
title: _protect_sheet_for_read_only_mirror
module: serve_b2b.py
lang: python
extraction: ast
signature: "(ws)"
role: "시트 하나에 라이브 미러 편집 잠금을 건다(워크북 일괄 보호와 같은 옵션)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3667-3701"

# ── 입출력 ──
inputs:
  - "ws"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "Excel COM 조작(파괴적일 수 있음)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_allow_read_only_mirror_selection"
calls_external:
  - "EXCEL_MIRROR_PROTECT_PASSWORD"
  - "Protect"
  - "ws"
called_by:
  - "_mirror_unprotected_for_paste"
  - "_protect_workbook_for_read_only_mirror"
reads:
  - "EXCEL_MIRROR_PROTECT_PASSWORD"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
시트 하나에 라이브 미러 편집 잠금을 건다(워크북 일괄 보호와 같은 옵션).

## 사이드이펙트 & 주의
- Excel COM 조작(파괴적일 수 있음)

## 관계
- 호출: `_allow_read_only_mirror_selection`
- 피호출(영향 전파 경로): `_mirror_unprotected_for_paste`, `_protect_workbook_for_read_only_mirror`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

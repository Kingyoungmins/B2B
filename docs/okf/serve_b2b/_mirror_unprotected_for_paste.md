---
type: function
title: _mirror_unprotected_for_paste
module: serve_b2b.py
lang: python
extraction: ast
signature: "(ws)"
role: "[붙여넣기 1004 수정 2026-08-12] 잠긴 시트에 '네이티브 복사'가 안 되는 문제."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3780-3811"

# ── 입출력 ──
inputs:
  - "ws"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_protect_sheet_for_read_only_mirror"
calls_external:
  - "EXCEL_MIRROR_PROTECT_PASSWORD"
  - "Unprotect"
  - "bool"
  - "ws"
called_by:
  - "PythonComSkillContext.copy"
  - "PythonComSkillContext.copy_values"
  - "PythonComSkillContext.paste_copied"
reads:
  - "EXCEL_MIRROR_PROTECT_PASSWORD"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[붙여넣기 1004 수정 2026-08-12] 잠긴 시트에 '네이티브 복사'가 안 되는 문제.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_protect_sheet_for_read_only_mirror`
- 피호출(영향 전파 경로): `PythonComSkillContext.copy`, `PythonComSkillContext.copy_values`, `PythonComSkillContext.paste_copied`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

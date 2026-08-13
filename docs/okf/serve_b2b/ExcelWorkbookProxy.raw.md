---
type: method
title: ExcelWorkbookProxy.raw
module: serve_b2b.py
lang: python
extraction: ast
class: ExcelWorkbookProxy
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:15567-15568"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "B2BHandler.handle_logic_backup"
  - "OpenpyxlSkillContext._write_grid"
  - "OpenpyxlSkillContext.display_rows"
  - "OpenpyxlSkillContext.flush_pending_rows"
  - "OpenpyxlSkillContext.sheet"
  - "OpenpyxlSkillContext.value"
  - "PythonComSkillContext.append_same_format_sheets"
  - "PythonComSkillContext.match_fill"
  - "_current_app_version"
  - "_live_final_snapshot_key"
  - "_pipeline_snapshot_key"
  - "_python_step_sig"
  - "_validate_vba_source_before_inject"
  - "_vba_security_scan"
  - "_workbook_name_lookup_keys"
reads:
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
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.handle_logic_backup`, `OpenpyxlSkillContext._write_grid`, `OpenpyxlSkillContext.display_rows`, `OpenpyxlSkillContext.flush_pending_rows`, `OpenpyxlSkillContext.sheet`, `OpenpyxlSkillContext.value`, `PythonComSkillContext.append_same_format_sheets`, `PythonComSkillContext.match_fill`, `_current_app_version`, `_live_final_snapshot_key`, `_pipeline_snapshot_key`, `_python_step_sig`, `_validate_vba_source_before_inject`, `_vba_security_scan`, `_workbook_name_lookup_keys`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: function
title: openpyxl_load_workbook_compatible
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path, **kwargs)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:3095-3110"

# ── 입출력 ──
inputs:
  - "path"
  - "**kwargs"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises:
  - "RuntimeError"
  - "first_err"

# ── 유기적 관계 ──
calls:
  - "is_ooxml_zip_file"
calls_external:
  - "BytesIO"
  - "Path"
  - "RuntimeError"
  - "buffer"
  - "kwargs"
  - "load_workbook"
  - "path"
  - "read_bytes"
called_by:
  - "OpenpyxlSkillContext._get_output_cached_wb"
  - "_run_openpyxl_python_pipeline_impl"
  - "inspect_workbook"
  - "load_workbook_aoa"
  - "write_result_workbook"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `is_ooxml_zip_file`
- 피호출(영향 전파 경로): `OpenpyxlSkillContext._get_output_cached_wb`, `_run_openpyxl_python_pipeline_impl`, `inspect_workbook`, `load_workbook_aoa`, `write_result_workbook`

## 실패/예외
- `RuntimeError`
- `first_err`

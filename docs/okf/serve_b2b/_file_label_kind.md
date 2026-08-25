---
type: function
title: _file_label_kind
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "[진단 계측 2026-08-12] 이 파일에 사내 보안 라벨(MIP)이 붙었는지 한 줄로 판별한다."
role_source: docstring
version: "0.7.5"
loc: "serve_b2b.py:3704-3735"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "is_encrypted_ooxml"
  - "read"
calls_external:
  - "Path"
  - "ZipFile"
  - "lower"
  - "namelist"
  - "open"
  - "p"
  - "path"
  - "startswith"
  - "str"
called_by:
  - "B2BHandler.handle_workbook_upload"
  - "_replace_excel_session_workbook_impl"
  - "_run_full_pipeline_single_instance_impl"
  - "_run_vba_pipeline_on_session_impl"
  - "_save_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[진단 계측 2026-08-12] 이 파일에 사내 보안 라벨(MIP)이 붙었는지 한 줄로 판별한다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `is_encrypted_ooxml`, `read`
- 피호출(영향 전파 경로): `B2BHandler.handle_workbook_upload`, `_replace_excel_session_workbook_impl`, `_run_full_pipeline_single_instance_impl`, `_run_vba_pipeline_on_session_impl`, `_save_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: function
title: _registered_path_for_name
module: serve_b2b.py
lang: python
extraction: ast
signature: "(name)"
role: "워크북 이름 → 업로드/세션 레지스트리의 파일 경로(교차파일 재생 시 소스 자동 열기용)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:11785-11813"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_workbook_name_lookup_key"
  - "values"
calls_external:
  - "Path"
  - "get"
  - "list"
  - "name"
  - "nm"
  - "p"
  - "str"
called_by:
  - "PythonComSkillContext.paste_copied"
reads:
  - "EXCEL_SESSIONS"
  - "WORKBOOKS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
워크북 이름 → 업로드/세션 레지스트리의 파일 경로(교차파일 재생 시 소스 자동 열기용).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_workbook_name_lookup_key`, `values`
- 피호출(영향 전파 경로): `PythonComSkillContext.paste_copied`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

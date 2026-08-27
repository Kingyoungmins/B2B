---
type: function
title: write_result_csv
module: serve_b2b.py
lang: python
extraction: ast
signature: "(result_path, sheets)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:21402-21408"

# ── 입출력 ──
inputs:
  - "result_path"
  - "sheets"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "csv_sheet_name"
calls_external:
  - "Path"
  - "f"
  - "get"
  - "iter"
  - "keys"
  - "next"
  - "open"
  - "result_path"
  - "sheet_name"
  - "writer"
  - "writerow"
called_by:
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
- 호출: `csv_sheet_name`
- 피호출(영향 전파 경로): `write_result_workbook`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

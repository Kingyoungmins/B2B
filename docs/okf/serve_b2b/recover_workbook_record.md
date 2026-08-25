---
type: function
title: recover_workbook_record
module: serve_b2b.py
lang: python
extraction: ast
signature: "(workbook_id)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.5"
loc: "serve_b2b.py:20581-20612"

# ── 입출력 ──
inputs:
  - "workbook_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): WORKBOOKS"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
  - "glob"
  - "is_file"
  - "len"
  - "path"
  - "sorted"
  - "str"
  - "time"
  - "workbook_id"
called_by:
  - "B2BHandler.handle_excel_open"
  - "B2BHandler.handle_workbook_source_download"
  - "get_workbook_or_raise"
reads:
  - "BACKEND_DIR"
  - "WORKBOOKS"
writes:
  - "WORKBOOKS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): WORKBOOKS
- 변경 상태 `WORKBOOKS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.handle_excel_open`, `B2BHandler.handle_workbook_source_download`, `get_workbook_or_raise`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

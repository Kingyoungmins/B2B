---
type: method
title: B2BHandler.handle_workbook_upload
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:1602-1663"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): WORKBOOKS"
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_file_label_kind"
  - "_vba_trace"
  - "excel_available"
  - "inspect_workbook"
  - "is_csv_path"
  - "read"
  - "send_json"
  - "values"
  - "write"
calls_external:
  - "Path"
  - "_sheets"
  - "_t_inspect"
  - "_t_write"
  - "bool"
  - "chunk"
  - "get"
  - "int"
  - "len"
  - "min"
  - "mkdir"
  - "name"
  - "open"
  - "parse_qs"
  - "path"
  - "perf_counter"
  - "raw_name"
  - "remaining"
  - "round"
  - "str"
  - "sum"
  - "time"
  - "unquote"
  - "urlparse"
  - "uuid4"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "BACKEND_DIR"
  - "WORKBOOKS"
  - "self.headers"
  - "self.path"
  - "self.rfile"
  - "self.send_json"
writes:
  - "WORKBOOKS"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): WORKBOOKS
- 파일시스템 변경/IO
- 변경 상태 `WORKBOOKS` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_file_label_kind`, `_vba_trace`, `excel_available`, `inspect_workbook`, `is_csv_path`, `read`, `send_json`, `values`, `write`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

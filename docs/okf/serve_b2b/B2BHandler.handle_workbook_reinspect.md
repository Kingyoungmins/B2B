---
type: method
title: B2BHandler.handle_workbook_reinspect
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "업로드 때 시트명을 못 읽은 워크북(meta.requiresExcel)을 다시 검사한다."
role_source: docstring
version: "0.7.3"
loc: "serve_b2b.py:1709-1733"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "inspect_workbook"
  - "read_json_body"
  - "send_json"
calls_external:
  - "Path"
  - "err"
  - "exists"
  - "get"
  - "path"
  - "str"
  - "strip"
  - "workbook_id"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "WORKBOOKS"
  - "self.read_json_body"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
업로드 때 시트명을 못 읽은 워크북(meta.requiresExcel)을 다시 검사한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `inspect_workbook`, `read_json_body`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

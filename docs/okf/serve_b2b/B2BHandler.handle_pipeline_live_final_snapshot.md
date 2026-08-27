---
type: method
title: B2BHandler.handle_pipeline_live_final_snapshot
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "[새로고침 즉시복원] 요청한 파일들에 '스킬 전부 적용된 최종 상태' 사본이 있는지 조회."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:2325-2344"

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
  - "_find_live_final_snapshot"
  - "append"
  - "read_json_body"
  - "send_json"
calls_external:
  - "bool"
  - "get"
  - "i"
  - "ids"
  - "rec"
  - "state_sig"
  - "str"
  - "wid"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "WORKBOOKS"
  - "self.read_json_body"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[새로고침 즉시복원] 요청한 파일들에 '스킬 전부 적용된 최종 상태' 사본이 있는지 조회.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_find_live_final_snapshot`, `append`, `read_json_body`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

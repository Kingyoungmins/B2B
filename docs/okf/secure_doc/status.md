---
type: function
title: status
module: secure_doc.py
lang: python
extraction: ast
signature: "(backend_dir=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "secure_doc.py:527-543"

# ── 입출력 ──
inputs:
  - "backend_dir"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "any_secured"
  - "config"
  - "probe"
calls_external:
  - "backend_dir"
  - "bool"
  - "get"
called_by:
  - "B2BHandler.do_GET"
  - "B2BHandler.send_json"
  - "_process_perf_snapshot"
  - "excel_record_status"
  - "start"
  - "stop"
  - "update_config"
reads:
  - "_LOCK"
  - "_STATE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `any_secured`, `config`, `probe`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `B2BHandler.send_json`, `_process_perf_snapshot`, `excel_record_status`, `start`, `stop`, `update_config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

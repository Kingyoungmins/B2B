---
type: function
title: group_to_pipeline_entry
module: record_service.py
lang: python
extraction: ast
signature: "(group, index)"
role: "묶음 하나 → B2B 파이프라인 스텝 dict (프론트 normalizeStep 이 소화하는 형태)."
role_source: docstring
version: "0.8.0"
loc: "record_service.py:548-591"

# ── 입출력 ──
inputs:
  - "group"
  - "index"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_body_has_statement"
  - "_group_sheets"
  - "append"
calls_external:
  - "body"
  - "code"
  - "descs"
  - "extend"
  - "get"
  - "group"
  - "int"
  - "join"
  - "len"
  - "lines"
  - "ln"
  - "lstrip"
  - "note"
  - "s"
  - "skipped"
  - "startswith"
  - "step_to_lines"
  - "str"
  - "strip"
  - "time"
called_by:
  - "RecordService._run"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
묶음 하나 → B2B 파이프라인 스텝 dict (프론트 normalizeStep 이 소화하는 형태).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_body_has_statement`, `_group_sheets`, `append`
- 피호출(영향 전파 경로): `RecordService._run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

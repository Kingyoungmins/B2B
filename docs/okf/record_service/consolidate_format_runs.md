---
type: function
title: consolidate_format_runs
module: record_service.py
lang: python
extraction: ast
signature: "(steps)"
role: "연속된 같은 (book,sheet) FORMAT 스텝 중 '서식이 완전히 같은' 것을 union 주소"
role_source: docstring
version: "0.8.0"
loc: "record_service.py:378-420"

# ── 입출력 ──
inputs:
  - "steps"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_format_payload"
  - "_format_unionable"
  - "_freeze_fmt"
  - "_union_addr_chunks"
  - "append"
  - "book"
  - "sheet"
calls_external:
  - "FORMAT"
  - "Step"
  - "Target"
  - "chunk"
  - "fmt"
  - "len"
  - "ranges"
  - "s"
  - "steps"
  - "t"
  - "tf"
called_by:
  - "RecordService._run"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
연속된 같은 (book,sheet) FORMAT 스텝 중 '서식이 완전히 같은' 것을 union 주소

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_format_payload`, `_format_unionable`, `_freeze_fmt`, `_union_addr_chunks`, `append`, `book`, `sheet`
- 피호출(영향 전파 경로): `RecordService._run`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

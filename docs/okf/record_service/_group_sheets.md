---
type: function
title: _group_sheets
module: record_service.py
lang: python
extraction: ast
signature: "(g)"
role: "묶음이 건드리는 시트명(등장 순서 유지, 중복 제거)."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:195-202"

# ── 입출력 ──
inputs:
  - "g"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "sh"
called_by:
  - "_group_title"
  - "group_to_pipeline_entry"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
묶음이 건드리는 시트명(등장 순서 유지, 중복 제거).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `_group_title`, `group_to_pipeline_entry`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

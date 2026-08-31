---
type: function
title: safe_component
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(name, fallback='unnamed')"
role: "폴더/파일 이름 한 조각으로 안전하게 만든다."
role_source: docstring
version: "0.8.2"
loc: "b2b_scheduler.py:94-106"

# ── 입출력 ──
inputs:
  - "name"
  - "fallback"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "ch"
  - "join"
  - "ord"
  - "str"
  - "strip"
called_by:
  - "delete_schedule"
  - "register_schedule"
  - "schedule_root"
  - "update_files"
  - "update_schedule"
reads:
  - "_BAD_NAME_CHARS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
폴더/파일 이름 한 조각으로 안전하게 만든다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `delete_schedule`, `register_schedule`, `schedule_root`, `update_files`, `update_schedule`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

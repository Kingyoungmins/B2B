---
type: function
title: _group_title
module: record_service.py
lang: python
extraction: ast
signature: "(g)"
role: "카드 제목 — 역할 + 대상 시트 + 스텝 수. \"구조 변경 (5스텝)\" 같은 무정보 제목 대신"
role_source: docstring
version: "0.8.2"
loc: "record_service.py:230-239"

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
  - "_group_sheets"
  - "sheets"
calls_external:
  - "g"
  - "get"
  - "join"
  - "len"
  - "r"
called_by:
  - "group_steps"
  - "merge_small_adjacent_groups"
reads:
  - "ROLE_TITLES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
카드 제목 — 역할 + 대상 시트 + 스텝 수. "구조 변경 (5스텝)" 같은 무정보 제목 대신

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_group_sheets`, `sheets`
- 피호출(영향 전파 경로): `group_steps`, `merge_small_adjacent_groups`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

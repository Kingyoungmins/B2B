---
type: function
title: _union_addr_chunks
module: record_service.py
lang: python
extraction: ast
signature: "(ranges, max_chars=200)"
role: "주소 목록을 union 문자열 덩어리로(snapshot.UNION_ADDR_MAX_CHARS 와 같은 상한)."
role_source: docstring
version: "0.8.1"
loc: "record_service.py:432-444"

# ── 입출력 ──
inputs:
  - "ranges"
  - "max_chars"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "cand"
  - "cur"
  - "len"
called_by:
  - "consolidate_format_runs"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
주소 목록을 union 문자열 덩어리로(snapshot.UNION_ADDR_MAX_CHARS 와 같은 상한).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `consolidate_format_runs`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

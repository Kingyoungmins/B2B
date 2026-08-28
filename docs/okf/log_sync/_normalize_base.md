---
type: function
title: _normalize_base
module: log_sync.py
lang: python
extraction: ast
signature: "(raw)"
role: "주소 뒤에 /v1 이나 /version 이 붙어 있어도 받아준다(설정 칸에 그대로 붙여넣는 경우)."
role_source: docstring
version: "0.8.1"
loc: "log_sync.py:98-106"

# ── 입출력 ──
inputs:
  - "raw"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "replace"
calls_external:
  - "endswith"
  - "len"
  - "lower"
  - "rstrip"
  - "str"
  - "strip"
  - "tail"
called_by:
  - "config"
  - "update_config"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
주소 뒤에 /v1 이나 /version 이 붙어 있어도 받아준다(설정 칸에 그대로 붙여넣는 경우).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `replace`
- 피호출(영향 전파 경로): `config`, `update_config`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

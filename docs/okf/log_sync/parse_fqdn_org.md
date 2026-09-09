---
type: function
title: parse_fqdn_org
module: log_sync.py
lang: python
extraction: ast
signature: "(dn)"
role: "DN 문자열 → 조직 dict. 파싱만 하는 순수 함수(테스트용 분리)."
role_source: docstring
version: "0.8.4"
loc: "log_sync.py:254-283"

# ── 입출력 ──
inputs:
  - "dn"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "cn"
  - "dn"
  - "group"
  - "int"
  - "join"
  - "levels"
  - "match"
  - "ordered"
  - "ou"
  - "sorted"
  - "split"
  - "startswith"
  - "str"
  - "strip"
called_by:
  - "org_info"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
DN 문자열 → 조직 dict. 파싱만 하는 순수 함수(테스트용 분리).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `org_info`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

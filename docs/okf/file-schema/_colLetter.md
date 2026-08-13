---
type: endpoint
title: _colLetter
module: file-schema.js
lang: js
extraction: regex   # 정규식 근사
signature: "(n)"
role: "1-based 열 번호 → 엑셀 열 문자(A, B, ..., AA ...). 스키마의 열문자↔헤더 매핑 출력용."
role_source: banner
version: "0.7.3"
loc: "file-schema.js:658-658"

# ── 입출력 ──
inputs:
  - "n"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "floor"
  - "fromCharCode"
  - "parseInt"
called_by:
  - "_describeFile"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
1-based 열 번호 → 엑셀 열 문자(A, B, ..., AA ...). 스키마의 열문자↔헤더 매핑 출력용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_describeFile`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

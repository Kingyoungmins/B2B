---
type: endpoint
title: sameVal
module: output-template.js
lang: js
extraction: regex   # 정규식 근사
signature: "(a, b)"
role: "원본 값과 동일한지 비교 (문자/숫자/Date 모두 안정 비교)"
role_source: banner
version: "0.8.2"
loc: "output-template.js:335-335"

# ── 입출력 ──
inputs:
  - "a"
  - "b"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "getTime"
called_by:
  - "updateSheetCells"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
원본 값과 동일한지 비교 (문자/숫자/Date 모두 안정 비교)

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `updateSheetCells`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

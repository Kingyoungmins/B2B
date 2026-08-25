---
type: endpoint
title: _formatNumberKR
module: excel-viewer.js
lang: js
extraction: regex   # 정규식 근사
signature: "(n)"
role: "숫자 표시 — 자릿수를 값 크기에 따라 동적으로. 0.998... 같은 비율 값이 \"1\" 로"
role_source: banner
version: "0.8.0"
loc: "excel-viewer.js:25-25"

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
  - "abs"
  - "isInteger"
  - "toLocaleString"
called_by:
  - "_formatCellDisplay"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
숫자 표시 — 자릿수를 값 크기에 따라 동적으로. 0.998... 같은 비율 값이 "1" 로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_formatCellDisplay`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

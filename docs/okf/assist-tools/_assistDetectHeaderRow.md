---
type: endpoint
title: _assistDetectHeaderRow
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(rows, explicitHeaderRow)"
role: "[헤더행 감지 통일] 실무 파일은 제목/빈 행이 헤더 위에 있는 경우가 흔하다. sheet.headers 는"
role_source: banner
version: "0.8.0"
loc: "assist-tools.js:68-68"

# ── 입출력 ──
inputs:
  - "rows"
  - "explicitHeaderRow"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Number"
  - "String"
  - "filter"
  - "isInteger"
  - "isNaN"
  - "max"
  - "min"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[헤더행 감지 통일] 실무 파일은 제목/빈 행이 헤더 위에 있는 경우가 흔하다. sheet.headers 는

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

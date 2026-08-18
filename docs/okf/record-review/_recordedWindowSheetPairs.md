---
type: endpoint
title: _recordedWindowSheetPairs
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code, initialWindow)"
role: "[교차창 stale Select 방지] 원본 VBA 를 줄 단위로 걸어 '어느 창(Windows/Workbooks) 활성 구간에서"
role_source: banner
version: "0.7.4"
loc: "record-review.js:534-534"

# ── 입출력 ──
inputs:
  - "code"
  - "initialWindow"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
calls_external:
  - "Range"
  - "Set"
  - "Sheets"
  - "String"
  - "exec"
  - "match"
  - "split"
  - "toLowerCase"
called_by:
  - "_stripSynthesizedSheetSelects"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[교차창 stale Select 방지] 원본 VBA 를 줄 단위로 걸어 '어느 창(Windows/Workbooks) 활성 구간에서

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`
- 피호출(영향 전파 경로): `_stripSynthesizedSheetSelects`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

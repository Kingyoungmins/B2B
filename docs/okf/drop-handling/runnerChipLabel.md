---
type: endpoint
title: runnerChipLabel
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(value)"
role: "칩에 보여줄 라벨: 10자까지는 그대로, 넘으면 10자 + …(전체 이름은 title 툴팁으로)."
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:1679-1679"

# ── 입출력 ──
inputs:
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "slice"
called_by:
  - "runnerRenderMappingPanel"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
칩에 보여줄 라벨: 10자까지는 그대로, 넘으면 10자 + …(전체 이름은 title 툴팁으로).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `runnerRenderMappingPanel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

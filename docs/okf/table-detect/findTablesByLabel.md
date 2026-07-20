---
type: endpoint
title: findTablesByLabel
module: table-detect.js
lang: js
extraction: regex   # 정규식 근사
signature: "(tables, label)"
role: "라벨이 같은 표가 여러 개일 때, 사용자가 \"첫 번째 표\" 등으로 모호하게 지칭한 경우"
role_source: banner
version: "0.5.19"
loc: "table-detect.js:133-133"

# ── 입출력 ──
inputs:
  - "tables"
  - "label"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "similarity"
calls_external:
  - "filter"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
라벨이 같은 표가 여러 개일 때, 사용자가 "첫 번째 표" 등으로 모호하게 지칭한 경우

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `similarity`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

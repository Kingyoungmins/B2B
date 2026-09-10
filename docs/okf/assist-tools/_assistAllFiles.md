---
type: endpoint
title: _assistAllFiles
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "못 찾으면 null. 여러 개에 걸리면(모호) 고치지 않고 null — 엉뚱한 파일을 읽는 것보다 available 목록을 돌려주는 게 낫다."
role_source: banner
version: "0.8.4"
loc: "assist-tools.js:165-165"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "forEach"
called_by:
  - "_assistResolveFile"
reads:
  - "state.inputs"
  - "state.outputTemplates"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
못 찾으면 null. 여러 개에 걸리면(모호) 고치지 않고 null — 엉뚱한 파일을 읽는 것보다 available 목록을 돌려주는 게 낫다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `_assistResolveFile`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

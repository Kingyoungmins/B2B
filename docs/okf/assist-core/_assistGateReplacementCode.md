---
type: endpoint
title: _assistGateReplacementCode
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(newCode, step, kind)"
role: "[Tier1] 교체 코드 정적 게이트 — 여러 곳에서 재사용(단일/일괄 치환). 통과 실패 사유 배열 반환."
role_source: banner
version: "0.8.0"
loc: "assist-core.js:760-760"

# ── 입출력 ──
inputs:
  - "newCode"
  - "step"
  - "kind"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
  - "run"
calls_external:
  - "String"
  - "fn"
  - "test"
called_by:
  - "assistBuildProposal"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[Tier1] 교체 코드 정적 게이트 — 여러 곳에서 재사용(단일/일괄 치환). 통과 실패 사유 배열 반환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`, `run`
- 피호출(영향 전파 경로): `assistBuildProposal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

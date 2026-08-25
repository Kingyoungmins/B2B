---
type: endpoint
title: dropStepCrossEvidence
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(step)"
role: "코드가 바뀌면 '어디에 썼는지'도 바뀐다 — 증거와 그 증거로 뜬 목적지 사본을 함께 버린다."
role_source: banner
version: "0.8.0"
loc: "pipeline.js:1302-1302"

# ── 입출력 ──
inputs:
  - "step"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "replaceLogicAt"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
코드가 바뀌면 '어디에 썼는지'도 바뀐다 — 증거와 그 증거로 뜬 목적지 사본을 함께 버린다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `replaceLogicAt`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

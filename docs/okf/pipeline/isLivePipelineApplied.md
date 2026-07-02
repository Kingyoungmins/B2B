---
type: endpoint
title: isLivePipelineApplied
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "직전에 라이브 파이프라인이 적용돼 있었는지. 강제재시작 직전에 캡처해 '자동 1회 재적용' 여부 판단에 쓴다"
role_source: banner
version: "0.5.18"
loc: "pipeline.js:2830-2830"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
직전에 라이브 파이프라인이 적용돼 있었는지. 강제재시작 직전에 캡처해 '자동 1회 재적용' 여부 판단에 쓴다

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

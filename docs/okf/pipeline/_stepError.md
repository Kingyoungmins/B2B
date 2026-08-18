---
type: endpoint
title: _stepError
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(info)"
role: "runPipeline 에서 발생한 step 오류를 풍부한 메시지로 감싸 던진다 (item 9)."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:3488-3488"

# ── 입출력 ──
inputs:
  - "info"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Error"
called_by:
  - "runPipeline"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
runPipeline 에서 발생한 step 오류를 풍부한 메시지로 감싸 던진다 (item 9).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `runPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

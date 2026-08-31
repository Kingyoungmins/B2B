---
type: endpoint
title: _assistErrorDiagnoseQuestion
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(info, options)"
role: "[실패 진단 연동] 오류 카드의 'AI 도움에게 진단 요청' 버튼이 넣을 자동 질문. 사용자가 친 것처럼"
role_source: banner
version: "0.8.2"
loc: "pipeline.js:7977-7977"

# ── 입출력 ──
inputs:
  - "info"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Number"
  - "isArray"
  - "some"
called_by:
  - "reportPipelineError"
  - "showRunnerPipelineError"
reads:
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
[실패 진단 연동] 오류 카드의 'AI 도움에게 진단 요청' 버튼이 넣을 자동 질문. 사용자가 친 것처럼

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `reportPipelineError`, `showRunnerPipelineError`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

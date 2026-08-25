---
type: endpoint
title: _setOverlayProgress
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[제보 2026-08-25] 오래 도는 재적용/전체실행에서 오버레이 문구가 고정이라 '멈춘 것 같다'는"
role_source: banner
version: "0.8.0"
loc: "pipeline.js:1312-1312"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "setExcelMirrorApplyLoadingProgress"
calls_external: []
called_by:
  - "runIsolatedLivePipelineSteps"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[제보 2026-08-25] 오래 도는 재적용/전체실행에서 오버레이 문구가 고정이라 '멈춘 것 같다'는

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `setExcelMirrorApplyLoadingProgress`
- 피호출(영향 전파 경로): `runIsolatedLivePipelineSteps`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

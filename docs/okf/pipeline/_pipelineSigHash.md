---
type: endpoint
title: _pipelineSigHash
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "대량 스텝에서 충돌 확률이 무시 못 할 수준이고, 충돌은 '엉뚱한 상태로 복원'이라 위험하다)."
role_source: banner
version: "0.8.1"
loc: "pipeline.js:137-137"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "charCodeAt"
  - "imul"
  - "padStart"
  - "toString"
called_by:
  - "liveEnabledStepsSignatureParts"
  - "pipelineLiveStateSig"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
대량 스텝에서 충돌 확률이 무시 못 할 수준이고, 충돌은 '엉뚱한 상태로 복원'이라 위험하다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `liveEnabledStepsSignatureParts`, `pipelineLiveStateSig`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

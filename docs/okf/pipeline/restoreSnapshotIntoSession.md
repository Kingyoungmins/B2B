---
type: endpoint
title: restoreSnapshotIntoSession
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "(snap, options = {})"
role: "— 그래서 여기로 모았다(restoreLastStepPreApplySnapshot 은 스텝에서 사본을 꺼내 이걸 부른다)."
role_source: banner
version: "0.7.4"
loc: "pipeline.js:4534-4534"

# ── 입출력 ──
inputs:
  - "snap"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_restoreSnapshotByIds"
calls_external: []
called_by:
  - "restorePipelineCheckpointForSuffix"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
— 그래서 여기로 모았다(restoreLastStepPreApplySnapshot 은 스텝에서 사본을 꺼내 이걸 부른다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_restoreSnapshotByIds`
- 피호출(영향 전파 경로): `restorePipelineCheckpointForSuffix`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

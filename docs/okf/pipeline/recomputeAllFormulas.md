---
type: endpoint
title: recomputeAllFormulas
module: pipeline.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "모든 파일/시트의 수식을 현재 데이터로 재평가해 state.formulaResults 에 저장."
role_source: banner
version: "0.7.3"
loc: "pipeline.js:3495-3495"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: formulaResults"
raises: []

# ── 유기적 관계 ──
calls:
  - "isHeavyFormulaRecompute"
  - "push"
  - "recomputeSheetFormulas"
calls_external:
  - "forEach"
  - "keys"
called_by:
  - "applyBackendPipelineResult"
  - "commitCellEdit"
  - "loadInputFiles"
  - "restoreHistorySnapshot"
  - "runPipeline"
reads:
  - "state.formulaResults"
  - "state.inputs"
  - "state.output"
  - "state.outputTemplates"
writes:
  - "formulaResults"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
모든 파일/시트의 수식을 현재 데이터로 재평가해 state.formulaResults 에 저장.

## 사이드이펙트 & 주의
- 상태 변경: formulaResults
- 변경 상태 `formulaResults` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `isHeavyFormulaRecompute`, `push`, `recomputeSheetFormulas`
- 피호출(영향 전파 경로): `applyBackendPipelineResult`, `commitCellEdit`, `loadInputFiles`, `restoreHistorySnapshot`, `runPipeline`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

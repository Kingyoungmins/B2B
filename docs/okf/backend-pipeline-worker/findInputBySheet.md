---
type: endpoint
title: findInputBySheet
module: backend-pipeline-worker.js
lang: js
extraction: regex   # 정규식 근사
signature: "(inputsMap, sheetName, options)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "backend-pipeline-worker.js:226-226"

# ── 입출력 ──
inputs:
  - "inputsMap"
  - "sheetName"
  - "options"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "normalizeText"
  - "push"
calls_external:
  - "entries"
  - "find"
  - "forEach"
  - "includes"
called_by:
  - "requestErrorRecovery"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `normalizeText`, `push`
- 피호출(영향 전파 경로): `requestErrorRecovery`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

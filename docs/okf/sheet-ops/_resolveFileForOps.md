---
type: endpoint
title: _resolveFileForOps
module: sheet-ops.js
lang: js
extraction: regex   # 정규식 근사
signature: "(fileRef)"
role: "파일 레퍼런스 (\"output\" / \"input:파일명\" / 파일명 / 파일 record) 를 실제 파일 객체로 해석"
role_source: banner
version: "0.7.3"
loc: "sheet-ops.js:36-36"

# ── 입출력 ──
inputs:
  - "fileRef"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "fuzzyMatch"
  - "outputTemplateIndexFromFileId"
  - "push"
calls_external:
  - "Number"
  - "find"
  - "map"
  - "slice"
  - "startsWith"
called_by:
  - "copyColumns"
  - "deleteColumns"
  - "insertColumns"
  - "setCellValue"
reads:
  - "state.inputs"
  - "state.output"
  - "state.outputTemplates"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
파일 레퍼런스 ("output" / "input:파일명" / 파일명 / 파일 record) 를 실제 파일 객체로 해석

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `fuzzyMatch`, `outputTemplateIndexFromFileId`, `push`
- 피호출(영향 전파 경로): `copyColumns`, `deleteColumns`, `insertColumns`, `setCellValue`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

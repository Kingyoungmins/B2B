---
type: endpoint
title: listAllWorkbookFileIds
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "업로드된 모든 파일의 fileId 목록(입력 + 출력). publishNativeFileTabs 와 동일한 규칙."
role_source: banner
version: "0.5.19"
loc: "excel-mirror.js:536-536"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "outputTemplateFileId"
  - "push"
  - "workbookDisplayName"
calls_external:
  - "forEach"
called_by:
  - "preopenAllExcelMirrors"
reads:
  - "state.inputs"
  - "state.output"
  - "state.outputTemplates"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
업로드된 모든 파일의 fileId 목록(입력 + 출력). publishNativeFileTabs 와 동일한 규칙.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `outputTemplateFileId`, `push`, `workbookDisplayName`
- 피호출(영향 전파 경로): `preopenAllExcelMirrors`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

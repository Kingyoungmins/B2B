---
type: endpoint
title: skillEnginePromptNote
module: file-schema.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "스킬 실행 엔진(Python/openpyxl)이 선택됐을 때 프롬프트에 덧붙이는 안내."
role_source: banner
version: "0.7.4"
loc: "file-schema.js:597-597"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "getSkillEngine"
calls_external:
  - "API"
  - "Activate"
  - "Cells"
  - "Columns"
  - "Copy"
  - "Excel"
  - "Insert"
  - "Python"
  - "Range"
  - "Rows"
  - "Select"
  - "append"
  - "cell"
  - "data_start_row"
  - "delete_cols"
  - "delete_rows"
  - "display_rows"
  - "input"
  - "insert_cols"
  - "insert_rows"
  - "iter_rows"
  - "rows"
  - "sheet"
  - "value"
called_by:
  - "callLLM"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
스킬 실행 엔진(Python/openpyxl)이 선택됐을 때 프롬프트에 덧붙이는 안내.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `getSkillEngine`
- 피호출(영향 전파 경로): `callLLM`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

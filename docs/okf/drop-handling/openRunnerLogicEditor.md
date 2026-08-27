---
type: endpoint
title: openRunnerLogicEditor
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[실행기 스킬 편집기] '스킬 수정'은 입력/출력의 '파일 수정/다운'과 같은 자리·같은 방식이어야 한다 —"
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:492-492"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "add"
  - "clearRunnerLogic"
  - "escapeHtml"
  - "setPage"
calls_external:
  - "click"
  - "filter"
  - "remove"
called_by:
  - "loadLogic"
  - "renderRunnerWorkflow"
reads:
  - "state.logicSaveBaseName"
  - "state.pipeline"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[실행기 스킬 편집기] '스킬 수정'은 입력/출력의 '파일 수정/다운'과 같은 자리·같은 방식이어야 한다 —

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$`, `add`, `clearRunnerLogic`, `escapeHtml`, `setPage`
- 피호출(영향 전파 경로): `loadLogic`, `renderRunnerWorkflow`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

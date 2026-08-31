---
type: endpoint
title: bindList
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "scheduler.js:1129-1129"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: error, registered, skill, skillFile"
raises: []

# ── 유기적 관계 ──
calls:
  - "$$"
  - "confirm"
  - "draftCron"
  - "draftProblems"
  - "draftText"
  - "esc"
  - "loadList"
  - "parseSkillZip"
  - "removeItem"
  - "render"
  - "renderList"
  - "saveEdit"
  - "saveSkillFiles"
  - "setPage"
calls_external:
  - "Number"
  - "String"
  - "addEventListener"
  - "assign"
  - "async"
  - "clear"
  - "click"
  - "closest"
  - "every"
  - "find"
  - "forEach"
  - "map"
  - "querySelector"
  - "slice"
  - "sort"
  - "trace"
called_by:
  - "bind"
reads:
  - "state.error"
  - "state.registered"
  - "state.schedule"
  - "state.skill"
  - "state.skillFile"
  - "state.traces"
writes:
  - "error"
  - "registered"
  - "skill"
  - "skillFile"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: error, registered, skill, skillFile
- 변경 상태 `error, registered, skill, skillFile` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `$$`, `confirm`, `draftCron`, `draftProblems`, `draftText`, `esc`, `loadList`, `parseSkillZip`, `removeItem`, `render`, `renderList`, `saveEdit`, `saveSkillFiles`, `setPage`
- 피호출(영향 전파 경로): `bind`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: bind
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "── 입력 배선 ───────────────────────────────────────────────────────────"
role_source: banner
version: "0.8.1"
loc: "scheduler.js:676-676"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: pending, registered"
raises: []

# ── 유기적 관계 ──
calls:
  - "$$"
  - "add"
  - "bindList"
  - "loadSkill"
  - "loadTrace"
  - "refreshSummary"
  - "render"
  - "saveSchedule"
  - "zoneOf"
calls_external:
  - "Cell"
  - "Number"
  - "addEventListener"
  - "click"
  - "closest"
  - "contains"
  - "forEach"
  - "preventDefault"
  - "querySelector"
  - "querySelectorAll"
  - "remove"
called_by: []
reads:
  - "state.pending"
  - "state.registered"
  - "state.schedule"
  - "state.skill"
  - "state.traces"
writes:
  - "pending"
  - "registered"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
── 입력 배선 ───────────────────────────────────────────────────────────

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: pending, registered
- 변경 상태 `pending, registered` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `$$`, `add`, `bindList`, `loadSkill`, `loadTrace`, `refreshSummary`, `render`, `saveSchedule`, `zoneOf`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: refreshSummary
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "입력 중에는 이 두 곳만 바꾼다(전체 재렌더 없이)."
role_source: banner
version: "0.8.1"
loc: "scheduler.js:548-548"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "$$"
  - "cycleText"
  - "deliveryText"
  - "esc"
  - "render"
  - "scheduleProblems"
calls_external:
  - "join"
  - "map"
  - "querySelector"
called_by:
  - "bind"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
입력 중에는 이 두 곳만 바꾼다(전체 재렌더 없이).

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `$$`, `cycleText`, `deliveryText`, `esc`, `render`, `scheduleProblems`
- 피호출(영향 전파 경로): `bind`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: assistClampIntoView
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(el)"
role: "화면 밖으로 나가 못 잡는 일이 없도록 항상 보이는 영역으로 되돌린다."
role_source: banner
version: "0.8.1"
loc: "assist-ui.js:34-34"

# ── 입출력 ──
inputs:
  - "el"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "max"
called_by:
  - "assistBindDrag"
  - "assistToggleDrawer"
  - "up"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
화면 밖으로 나가 못 잡는 일이 없도록 항상 보이는 영역으로 되돌린다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistBindDrag`, `assistToggleDrawer`, `up`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

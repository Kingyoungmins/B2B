---
type: endpoint
title: assistSetStatus
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(s)"
role: "컨테이너 id 는 창 안(assist-ui.js)과 팝업(assist.html)이 같아 한 곳만 고치면 둘 다 적용된다."
role_source: banner
version: "0.7.4"
loc: "assist-ui.js:234-234"

# ── 입출력 ──
inputs:
  - "s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "appendChild"
  - "createElement"
  - "getElementById"
  - "querySelector"
  - "remove"
  - "replace"
  - "setAttribute"
  - "trim"
called_by:
  - "assistEnsureDom"
  - "assistSubmit"
  - "send"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
컨테이너 id 는 창 안(assist-ui.js)과 팝업(assist.html)이 같아 한 곳만 고치면 둘 다 적용된다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistEnsureDom`, `assistSubmit`, `send`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

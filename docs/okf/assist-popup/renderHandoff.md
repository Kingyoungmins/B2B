---
type: endpoint
title: renderHandoff
module: assist-popup.js
lang: js
extraction: regex   # 정규식 근사
signature: "(meta)"
role: "[Tier1] 핸드오프 카드 — 버튼은 메인 창에 요청문 이관을 부탁한다(팝업은 메인 DOM 을 못 만짐)."
role_source: banner
version: "0.7.3"
loc: "assist-popup.js:281-281"

# ── 입출력 ──
inputs:
  - "meta"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "addMsg"
  - "esc"
  - "post"
calls_external:
  - "Number"
  - "String"
  - "closest"
  - "forEach"
  - "isArray"
  - "querySelector"
  - "querySelectorAll"
called_by:
  - "onBridge"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[Tier1] 핸드오프 카드 — 버튼은 메인 창에 요청문 이관을 부탁한다(팝업은 메인 DOM 을 못 만짐).

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `addMsg`, `esc`, `post`
- 피호출(영향 전파 경로): `onBridge`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

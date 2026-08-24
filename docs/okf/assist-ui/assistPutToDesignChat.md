---
type: endpoint
title: assistPutToDesignChat
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(req)"
role: "[Tier1] 핸드오프 카드 — 새 단계 생성은 ③ 설계 채팅의 일. 정리된 요청문을 넣어주고 사용자가 검토·전송."
role_source: banner
version: "0.7.5"
loc: "assist-ui.js:290-290"

# ── 입출력 ──
inputs:
  - "req"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "setPage"
calls_external:
  - "String"
  - "focus"
  - "getElementById"
called_by:
  - "assistRenderHandoffCard"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[Tier1] 핸드오프 카드 — 새 단계 생성은 ③ 설계 채팅의 일. 정리된 요청문을 넣어주고 사용자가 검토·전송.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `setPage`
- 피호출(영향 전파 경로): `assistRenderHandoffCard`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

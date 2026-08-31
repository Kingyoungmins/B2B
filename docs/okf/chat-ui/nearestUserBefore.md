---
type: endpoint
title: nearestUserBefore
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(i)"
role: "코드 말풍선 앞의 '진짜' 사용자 요청을 찾는다. 자동 재생성/복구 프롬프트는 건너뛰고 더 앞으로."
role_source: banner
version: "0.8.2"
loc: "chat-ui.js:217-217"

# ── 입출력 ──
inputs:
  - "i"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_isSyntheticRequest"
calls_external: []
called_by:
  - "_matchStepToChatIndex"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
코드 말풍선 앞의 '진짜' 사용자 요청을 찾는다. 자동 재생성/복구 프롬프트는 건너뛰고 더 앞으로.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_isSyntheticRequest`
- 피호출(영향 전파 경로): `_matchStepToChatIndex`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

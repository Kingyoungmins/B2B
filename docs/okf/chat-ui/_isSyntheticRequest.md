---
type: endpoint
title: _isSyntheticRequest
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[순수 코어] 스텝을 채팅 엔트리(display 순서 [{role, text, code}])에 매칭 → 스크롤할 엔트리 인덱스."
role_source: banner
version: "0.7.5"
loc: "chat-ui.js:158-158"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "test"
called_by:
  - "_matchStepToChatIndex"
  - "nearestUserBefore"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[순수 코어] 스텝을 채팅 엔트리(display 순서 [{role, text, code}])에 매칭 → 스크롤할 엔트리 인덱스.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_matchStepToChatIndex`, `nearestUserBefore`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

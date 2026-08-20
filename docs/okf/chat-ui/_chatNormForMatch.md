---
type: endpoint
title: _chatNormForMatch
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(s)"
role: "---- [스킬 수정 → 원 요청으로 스크롤] ----"
role_source: banner
version: "0.7.4"
loc: "chat-ui.js:112-112"

# ── 입출력 ──
inputs:
  - "s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "replace"
  - "slice"
  - "trim"
called_by:
  - "_chatMatchScore"
  - "_matchStepToChatIndex"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
---- [스킬 수정 → 원 요청으로 스크롤] ----

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_chatMatchScore`, `_matchStepToChatIndex`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

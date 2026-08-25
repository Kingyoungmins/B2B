---
type: endpoint
title: stopButtonsHtml
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "#10: think 모드면 '생각 중단'(thinking 만 끊고 답변 받기) + '요청 중단'(전체 종료) 두 버튼,"
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:2719-2719"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "initialize"
  - "setupStreamingAssistantMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
#10: think 모드면 '생각 중단'(thinking 만 끊고 답변 받기) + '요청 중단'(전체 종료) 두 버튼,

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `initialize`, `setupStreamingAssistantMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: assistLooksLikeFakeButtonNarration
module: assist-core.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "① \"아래/이 버튼\" 처럼 자기 응답 속 버튼을 가리키거나 ② 대괄호 라벨이 한 줄을 통째로 차지할 때만 잡는다."
role_source: banner
version: "0.7.4"
loc: "assist-core.js:241-241"

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
  - "trim"
called_by:
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
① "아래/이 버튼" 처럼 자기 응답 속 버튼을 가리키거나 ② 대괄호 라벨이 한 줄을 통째로 차지할 때만 잡는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

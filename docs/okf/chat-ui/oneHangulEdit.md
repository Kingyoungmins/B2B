---
type: endpoint
title: oneHangulEdit
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(a, b)"
role: "한 글자 차이(같은 길이 치환 1 / 길이±1 삽입·삭제 1)인지 + 그 차이가 한글인지."
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:586-586"

# ── 입출력 ──
inputs:
  - "a"
  - "b"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isHangul"
calls_external:
  - "abs"
  - "slice"
called_by:
  - "hangulLiteralTypoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
한 글자 차이(같은 길이 치환 1 / 길이±1 삽입·삭제 1)인지 + 그 차이가 한글인지.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isHangul`
- 피호출(영향 전파 경로): `hangulLiteralTypoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

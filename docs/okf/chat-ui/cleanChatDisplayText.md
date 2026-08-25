---
type: endpoint
title: cleanChatDisplayText
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(content)"
role: "[말풍선 표시 정리] 저장된 대화를 다시 그릴 때, 내부 프롬프트 스캐폴딩은 감추고 '사용자가 직접 친 부분'만"
role_source: banner
version: "0.8.0"
loc: "chat-ui.js:268-268"

# ── 입출력 ──
inputs:
  - "content"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "exec"
  - "n"
  - "replace"
  - "test"
  - "trim"
called_by:
  - "renderChatFromHistory"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[말풍선 표시 정리] 저장된 대화를 다시 그릴 때, 내부 프롬프트 스캐폴딩은 감추고 '사용자가 직접 친 부분'만

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `renderChatFromHistory`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

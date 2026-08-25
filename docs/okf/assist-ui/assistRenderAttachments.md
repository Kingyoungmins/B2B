---
type: endpoint
title: assistRenderAttachments
module: assist-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "[첨부] 대기 중 첨부 파일을 카드(파일명 + 삭제)로 렌더. 없으면 목록을 숨긴다."
role_source: banner
version: "0.8.0"
loc: "assist-ui.js:153-153"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "escapeHtml"
calls_external:
  - "Number"
  - "forEach"
  - "getElementById"
  - "join"
  - "map"
  - "querySelectorAll"
  - "splice"
called_by:
  - "assistClearAttachments"
  - "assistEnsureDom"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[첨부] 대기 중 첨부 파일을 카드(파일명 + 삭제)로 렌더. 없으면 목록을 숨긴다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `escapeHtml`
- 피호출(영향 전파 경로): `assistClearAttachments`, `assistEnsureDom`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

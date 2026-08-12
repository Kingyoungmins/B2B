---
type: endpoint
title: uploadAttachments
module: assist-popup.js
lang: js
extraction: regex   # 정규식 근사
signature: "(staged)"
role: "[첨부] 팝업은 백엔드로 첨부를 올려 슬라이드/이미지 base64 를 받는다(팝업도 같은 서버 오리진)."
role_source: banner
version: "0.7.3"
loc: "assist-popup.js:225-225"

# ── 입출력 ──
inputs:
  - "staged"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "Error"
  - "arrayBuffer"
  - "encodeURIComponent"
  - "fetch"
  - "forEach"
  - "json"
called_by:
  - "send"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[첨부] 팝업은 백엔드로 첨부를 올려 슬라이드/이미지 base64 를 받는다(팝업도 같은 서버 오리진).

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `send`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

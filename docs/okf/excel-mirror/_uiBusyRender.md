---
type: endpoint
title: _uiBusyRender
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "진행률이 아무 데도 안 보이는 회귀를 막는 안전망)."
role_source: banner
version: "0.8.2"
loc: "excel-mirror.js:222-222"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "publishNativeUiBusy"
calls_external:
  - "String"
  - "getElementById"
  - "querySelector"
called_by:
  - "setUiBusySuffix"
  - "updateUiBusyLabel"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
진행률이 아무 데도 안 보이는 회귀를 막는 안전망).

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: `publishNativeUiBusy`
- 피호출(영향 전파 경로): `setUiBusySuffix`, `updateUiBusyLabel`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

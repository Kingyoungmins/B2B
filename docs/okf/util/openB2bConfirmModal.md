---
type: endpoint
title: openB2bConfirmModal
module: util.js
lang: js
extraction: regex   # 정규식 근사
signature: "(message, options = {})"
role: "[필드 수정] WebView2 의 네이티브 confirm() 은 항상-위 Excel 미러 창/포커스 보정 타이머와"
role_source: banner
version: "0.7.4"
loc: "util.js:33-33"

# ── 입출력 ──
inputs:
  - "message"
  - "options = {}"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Promise"
  - "String"
  - "addEventListener"
  - "appendChild"
  - "calc"
  - "createElement"
  - "done"
  - "focus"
  - "getElementById"
  - "preventDefault"
  - "remove"
  - "removeEventListener"
  - "resolve"
  - "rgba"
  - "stopPropagation"
called_by:
  - "softRefreshApp"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[필드 수정] WebView2 의 네이티브 confirm() 은 항상-위 Excel 미러 창/포커스 보정 타이머와

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `softRefreshApp`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: publishNativeUiBusy
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(active, label, failsafeMs)"
role: "업로드한 모든 파일(보통 입력 여러 개 + 출력)을 미리 열어 스택해 둔다."
role_source: banner
version: "0.8.2"
loc: "excel-mirror.js:59-59"

# ── 입출력 ──
inputs:
  - "active"
  - "label"
  - "failsafeMs"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Number"
  - "String"
  - "enc"
  - "encodeURIComponent"
  - "failsafe"
  - "join"
  - "max"
  - "postMessage"
called_by:
  - "_uiBusyRender"
  - "beginUiBusy"
  - "endUiBusy"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
업로드한 모든 파일(보통 입력 여러 개 + 출력)을 미리 열어 스택해 둔다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_uiBusyRender`, `beginUiBusy`, `endUiBusy`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

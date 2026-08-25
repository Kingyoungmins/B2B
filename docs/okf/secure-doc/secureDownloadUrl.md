---
type: endpoint
title: secureDownloadUrl
module: secure-doc.js
lang: js
extraction: regex   # 정규식 근사
signature: "(url, filename)"
role: "안내와 실패 처리를 하고, 평소엔 기존처럼 a.href 로 바로 받는다."
role_source: banner
version: "0.8.0"
loc: "secure-doc.js:144-144"

# ── 입출력 ──
inputs:
  - "url"
  - "filename"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "secureDocNotice"
  - "secureDocNoticeHide"
  - "secureDocSaveBlobPlain"
  - "secureDocStatus"
  - "toast"
calls_external:
  - "Error"
  - "String"
  - "appendChild"
  - "blob"
  - "click"
  - "createElement"
  - "fetch"
  - "json"
  - "remove"
called_by:
  - "downloadBackendOutput"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
안내와 실패 처리를 하고, 평소엔 기존처럼 a.href 로 바로 받는다.

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 네트워크/서버 호출

## 관계
- 호출: `secureDocNotice`, `secureDocNoticeHide`, `secureDocSaveBlobPlain`, `secureDocStatus`, `toast`
- 피호출(영향 전파 경로): `downloadBackendOutput`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: endpoint
title: secureDocSaveBlobPlain
module: secure-doc.js
lang: js
extraction: regex   # 정규식 근사
signature: "(blob, filename)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "secure-doc.js:104-104"

# ── 입출력 ──
inputs:
  - "blob"
  - "filename"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "appendChild"
  - "click"
  - "createElement"
  - "createObjectURL"
  - "remove"
  - "revokeObjectURL"
  - "setTimeout"
called_by:
  - "secureDocSaveBlob"
  - "secureDownloadUrl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 타이머

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `secureDocSaveBlob`, `secureDownloadUrl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

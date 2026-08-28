---
type: endpoint
title: secureDocSniff
module: secure-doc.js
lang: js
extraction: regex   # 정규식 근사
signature: "(file)"
role: "PK(zip)=평문 xlsx, OLE 복합문서=보안 가능성, 그 외 이진(0x00 포함)=보안 가능성."
role_source: banner
version: "0.8.1"
loc: "secure-doc.js:86-86"

# ── 입출력 ──
inputs:
  - "file"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "secureDocStatus"
calls_external:
  - "Uint8Array"
  - "arrayBuffer"
  - "slice"
called_by:
  - "registerWorkbookBackend"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
PK(zip)=평문 xlsx, OLE 복합문서=보안 가능성, 그 외 이진(0x00 포함)=보안 가능성.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `secureDocStatus`
- 피호출(영향 전파 경로): `registerWorkbookBackend`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

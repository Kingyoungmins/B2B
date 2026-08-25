---
type: endpoint
title: secureDocSaveBlob
module: secure-doc.js
lang: js
extraction: regex   # 정규식 근사
signature: "(blob, filename)"
role: "저장 직전 훅 — 실패 시 평문 저장은 하지 않는다(토스트로 알리고 중단)."
role_source: banner
version: "0.8.0"
loc: "secure-doc.js:132-132"

# ── 입출력 ──
inputs:
  - "blob"
  - "filename"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "secureDocMaybeEncryptBlob"
  - "secureDocSaveBlobPlain"
  - "toast"
calls_external:
  - "String"
  - "alert"
  - "then"
called_by:
  - "exportOutputCsv"
  - "exportOutputXlsx"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
저장 직전 훅 — 실패 시 평문 저장은 하지 않는다(토스트로 알리고 중단).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `secureDocMaybeEncryptBlob`, `secureDocSaveBlobPlain`, `toast`
- 피호출(영향 전파 경로): `exportOutputCsv`, `exportOutputXlsx`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

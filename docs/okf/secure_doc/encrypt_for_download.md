---
type: function
title: encrypt_for_download
module: secure_doc.py
lang: python
extraction: ast
signature: "(data, filename, workbook_id='')"
role: "다운로드 직전 보안 재적용. 실패는 SecureDocError — 부르는 쪽이 다운로드를 중단한다."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:550-558"

# ── 입출력 ──
inputs:
  - "data"
  - "filename"
  - "workbook_id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _STATE"
raises: []

# ── 유기적 관계 ──
calls:
  - "encrypt_bytes"
  - "recall_label"
calls_external:
  - "data"
  - "filename"
  - "workbook_id"
called_by:
  - "B2BHandler.do_POST"
  - "_secure_outgoing_data"
reads:
  - "_LOCK"
  - "_STATE"
writes:
  - "_STATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
다운로드 직전 보안 재적용. 실패는 SecureDocError — 부르는 쪽이 다운로드를 중단한다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _STATE
- 변경 상태 `_STATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `encrypt_bytes`, `recall_label`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`, `_secure_outgoing_data`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

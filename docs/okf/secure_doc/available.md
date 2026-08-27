---
type: function
title: available
module: secure_doc.py
lang: python
extraction: ast
signature: "()"
role: "지금 보안 해제/적용을 시도할 수 있는 상태인가(기능 켜짐 + 서버에 키 설정됨)."
role_source: docstring
version: "0.8.0"
loc: "secure_doc.py:156-162"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "config"
  - "probe"
calls_external:
  - "bool"
  - "get"
called_by:
  - "maybe_decrypt_upload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
지금 보안 해제/적용을 시도할 수 있는 상태인가(기능 켜짐 + 서버에 키 설정됨).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `config`, `probe`
- 피호출(영향 전파 경로): `maybe_decrypt_upload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

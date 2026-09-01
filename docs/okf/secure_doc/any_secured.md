---
type: function
title: any_secured
module: secure_doc.py
lang: python
extraction: ast
signature: "(backend_dir=None)"
role: "이번 실행에 보안 해제한 문서가 하나라도 있나 — 있으면 문서 다운로드에 보안을 다시 건다."
role_source: docstring
version: "0.8.2"
loc: "secure_doc.py:580-591"

# ── 입출력 ──
inputs:
  - "backend_dir"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "any"
  - "backend_dir"
  - "glob"
  - "is_dir"
called_by:
  - "_secure_outgoing_data"
  - "status"
reads:
  - "MARKER_SUFFIX"
  - "_LOCK"
  - "_STATE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
이번 실행에 보안 해제한 문서가 하나라도 있나 — 있으면 문서 다운로드에 보안을 다시 건다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_secure_outgoing_data`, `status`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

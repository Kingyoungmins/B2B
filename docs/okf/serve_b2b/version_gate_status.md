---
type: function
title: version_gate_status
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "시작 1회 검사 결과. 팝업 종류(kind)와 표시 여부(show)까지 정해서 준다."
role_source: docstring
version: "0.8.4"
loc: "serve_b2b.py:434-455"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _VERSION_GATE"
raises: []

# ── 유기적 관계 ──
calls:
  - "_version_gate_check"
calls_external:
  - "bool"
  - "dict"
  - "get"
called_by:
  - "B2BHandler.do_GET"
reads:
  - "VERSION_GATE_DEFAULT_DOWNLOAD_URL"
  - "_VERSION_GATE"
writes:
  - "_VERSION_GATE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
시작 1회 검사 결과. 팝업 종류(kind)와 표시 여부(show)까지 정해서 준다.

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _VERSION_GATE
- 변경 상태 `_VERSION_GATE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `_version_gate_check`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

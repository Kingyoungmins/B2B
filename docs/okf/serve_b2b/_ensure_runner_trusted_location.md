---
type: function
title: _ensure_runner_trusted_location
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "러너 폴더를 Excel '신뢰할 수 있는 위치(Trusted Location)'로 등록한다."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:5534-5570"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_b2b_runner_trusted_dir"
calls_external:
  - "CloseKey"
  - "CreateKey"
  - "SetValueEx"
  - "base"
  - "endswith"
  - "loc"
  - "path_str"
  - "str"
  - "tl"
called_by:
  - "_ensure_vbom_access"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
러너 폴더를 Excel '신뢰할 수 있는 위치(Trusted Location)'로 등록한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_b2b_runner_trusted_dir`
- 피호출(영향 전파 경로): `_ensure_vbom_access`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

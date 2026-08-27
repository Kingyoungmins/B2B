---
type: function
title: _signature_code_for_snapshot
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "[SBAGENT-293 실측 2026-08-26] 스냅샷 서명용 코드 정규화 — '실행 결과에 영향 없는' 부분 제거."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:19589-19623"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "StringIO"
  - "comments"
  - "generate_tokens"
  - "join"
  - "len"
  - "lines"
  - "match"
  - "out"
  - "rstrip"
  - "sorted"
  - "split"
  - "str"
  - "strip"
  - "text"
called_by:
  - "_fullrun_step_signature"
  - "_step_signature"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[SBAGENT-293 실측 2026-08-26] 스냅샷 서명용 코드 정규화 — '실행 결과에 영향 없는' 부분 제거.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `_fullrun_step_signature`, `_step_signature`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

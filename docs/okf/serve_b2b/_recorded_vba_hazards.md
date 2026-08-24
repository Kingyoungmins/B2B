---
type: function
title: _recorded_vba_hazards
module: serve_b2b.py
lang: python
extraction: ast
signature: "(code)"
role: "녹화 VBA 에서 '절대참조 재현이 불안정한' 패턴을 감지해 사용자 경고를 만든다."
role_source: docstring
version: "0.7.4"
loc: "serve_b2b.py:6794-6824"

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
  - "_vba_security_scan"
  - "append"
calls_external:
  - "search"
  - "str"
  - "text"
called_by:
  - "excel_record_stop"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
녹화 VBA 에서 '절대참조 재현이 불안정한' 패턴을 감지해 사용자 경고를 만든다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_vba_security_scan`, `append`
- 피호출(영향 전파 경로): `excel_record_stop`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

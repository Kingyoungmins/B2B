---
type: function
title: _write_preview
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "(event)"
role: "무엇이 나가는지 남긴다. 접속 정보가 없을 때 이게 유일한 산출물이다."
role_source: docstring
version: "0.8.2"
loc: "b2b_telemetry.py:366-377"

# ── 입출력 ──
inputs:
  - "event"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "write"
calls_external:
  - "dumps"
  - "items"
  - "open"
  - "path"
  - "startswith"
called_by:
  - "_worker"
reads:
  - "_state"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
무엇이 나가는지 남긴다. 접속 정보가 없을 때 이게 유일한 산출물이다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `write`
- 피호출(영향 전파 경로): `_worker`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

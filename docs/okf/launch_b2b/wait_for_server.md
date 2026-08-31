---
type: function
title: wait_for_server
module: launch_b2b.py
lang: python
extraction: ast
signature: "(url: str, timeout: float=15.0) -> bool"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "launch_b2b.py:127-136"

# ── 입출력 ──
inputs:
  - "url: str"
  - "timeout: float"
returns: "bool"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크 호출"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "sleep"
  - "time"
  - "url"
  - "urlopen"
called_by:
  - "main"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크 호출

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `main`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

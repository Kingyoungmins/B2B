---
type: function
title: current_windows_user
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "()"
role: "현재 로그인한 윈도우 계정 — cmd 의 `whoami` 와 같은 형식(도메인\\사용자, 소문자)."
role_source: docstring
version: "0.8.2"
loc: "b2b_scheduler.py:50-73"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "bool"
  - "get"
  - "gethostname"
  - "getuser"
  - "lower"
  - "name"
called_by:
  - "schedule_root"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
현재 로그인한 윈도우 계정 — cmd 의 `whoami` 와 같은 형식(도메인\사용자, 소문자).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `schedule_root`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

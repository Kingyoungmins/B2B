---
type: function
title: current_user
module: log_sync.py
lang: python
extraction: ast
signature: "()"
role: "사용자 구분은 whoami 결과(도메인\\사용자)를 쓴다 — 사내에서 이 값이 사람과 1:1 이다."
role_source: docstring
version: "0.8.1"
loc: "log_sync.py:172-200"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "서브프로세스/OS 호출"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "STARTUPINFO"
  - "decode"
  - "flags"
  - "get"
  - "getattr"
  - "getuser"
  - "run"
  - "startupinfo"
  - "str"
  - "strip"
  - "subprocess"
called_by:
  - "_ensure_user"
  - "default_account"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
사용자 구분은 whoami 결과(도메인\사용자)를 쓴다 — 사내에서 이 값이 사람과 1:1 이다.

## 사이드이펙트 & 주의
- 서브프로세스/OS 호출

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_ensure_user`, `default_account`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

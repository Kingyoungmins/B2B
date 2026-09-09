---
type: function
title: org_info
module: log_sync.py
lang: python
extraction: ast
signature: "()"
role: "`whoami /fqdn` 의 조직 계층을 파싱한다(도메인 VM 전용 — 실측 2026-09-02)."
role_source: docstring
version: "0.8.4"
loc: "log_sync.py:211-251"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): _ORG_CACHE"
  - "서브프로세스/OS 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "parse_fqdn_org"
calls_external:
  - "STARTUPINFO"
  - "decode"
  - "dict"
  - "flags"
  - "getattr"
  - "out"
  - "run"
  - "startupinfo"
  - "strip"
  - "subprocess"
  - "text"
called_by:
  - "_ensure_session"
  - "current_windows_user"
reads:
  - "_ORG_CACHE"
writes:
  - "_ORG_CACHE"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
`whoami /fqdn` 의 조직 계층을 파싱한다(도메인 VM 전용 — 실측 2026-09-02).

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): _ORG_CACHE
- 서브프로세스/OS 호출
- 변경 상태 `_ORG_CACHE` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `parse_fqdn_org`
- 피호출(영향 전파 경로): `_ensure_session`, `current_windows_user`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

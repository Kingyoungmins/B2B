---
type: method
title: B2BHandler.handle_excel_runner_mode
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:2632-2641"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): LIVE_RESTORE_SUPPRESSED"
raises: []

# ── 유기적 관계 ──
calls:
  - "read_json_body"
  - "send_json"
calls_external:
  - "bool"
  - "err"
  - "get"
  - "str"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "LIVE_RESTORE_SUPPRESSED"
  - "self.read_json_body"
  - "self.send_json"
writes:
  - "LIVE_RESTORE_SUPPRESSED"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): LIVE_RESTORE_SUPPRESSED
- 변경 상태 `LIVE_RESTORE_SUPPRESSED` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `read_json_body`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

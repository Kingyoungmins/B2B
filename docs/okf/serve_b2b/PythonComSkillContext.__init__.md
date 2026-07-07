---
type: method
title: PythonComSkillContext.__init__
module: serve_b2b.py
lang: python
extraction: ast
class: PythonComSkillContext
signature: "(self, app, wb, session, _shared=None, timeout_s=None)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "serve_b2b.py:8614-8626"

# ── 입출력 ──
inputs:
  - "self"
  - "app"
  - "wb"
  - "session"
  - "_shared"
  - "timeout_s"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self._app, self._session, self._shared, self._wb"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "float"
  - "monotonic"
  - "timeout_s"
called_by: []
reads:
  - "PY_SKILL_TIMEOUT_S"
writes:
  - "self._app"
  - "self._session"
  - "self._shared"
  - "self._wb"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self._app, self._session, self._shared, self._wb
- 변경 상태 `self._app, self._session, self._shared, self._wb` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

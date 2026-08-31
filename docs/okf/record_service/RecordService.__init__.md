---
type: method
title: RecordService.__init__
module: record_service.py
lang: python
extraction: ast
class: RecordService
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "record_service.py:622-630"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self._error, self._handler, self._lock, self._recording, self._result, self._sink, self._stop_evt, self._thread"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Event"
  - "Lock"
called_by: []
reads: []
writes:
  - "self._error"
  - "self._handler"
  - "self._lock"
  - "self._recording"
  - "self._result"
  - "self._sink"
  - "self._stop_evt"
  - "self._thread"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self._error, self._handler, self._lock, self._recording, self._result, self._sink, self._stop_evt, self._thread
- 변경 상태 `self._error, self._handler, self._lock, self._recording, self._result, self._sink, self._stop_evt, self._thread` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

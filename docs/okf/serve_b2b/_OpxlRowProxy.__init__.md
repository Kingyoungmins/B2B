---
type: method
title: _OpxlRowProxy.__init__
module: serve_b2b.py
lang: python
extraction: ast
class: _OpxlRowProxy
signature: "(self, sheet_proxy, row_idx)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:17512-17515"

# ── 입출력 ──
inputs:
  - "self"
  - "sheet_proxy"
  - "row_idx"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): self._row_idx, self._sheet_proxy, self._ws"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "int"
  - "row_idx"
called_by: []
reads: []
writes:
  - "self._row_idx"
  - "self._sheet_proxy"
  - "self._ws"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): self._row_idx, self._sheet_proxy, self._ws
- 변경 상태 `self._row_idx, self._sheet_proxy, self._ws` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

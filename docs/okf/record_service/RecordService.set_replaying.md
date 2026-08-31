---
type: method
title: RecordService.set_replaying
module: record_service.py
lang: python
extraction: ast
class: RecordService
signature: "(self, value)"
role: "B2B Excel 워커가 잡 실행 전/후 호출 — 녹화 중이면 B2B 자신의 변경을"
role_source: docstring
version: "0.8.2"
loc: "record_service.py:607-618"

# ── 입출력 ──
inputs:
  - "self"
  - "value"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "value"
calls_external:
  - "bool"
  - "is_set"
called_by: []
reads:
  - "self._handler"
  - "self._lock"
  - "self._recording"
  - "self._stop_evt"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
B2B Excel 워커가 잡 실행 전/후 호출 — 녹화 중이면 B2B 자신의 변경을

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `value`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

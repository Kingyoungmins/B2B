---
type: function
title: marshal_app_stream
module: record_service.py
lang: python
extraction: ast
signature: "(app)"
role: "Excel 워커 스레드에서 호출 — Application 프록시를 스레드 간 스트림으로 마샬링."
role_source: docstring
version: "0.8.2"
loc: "record_service.py:206-210"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "CoMarshalInterThreadInterfaceInStream"
called_by:
  - "excel_record_start"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
Excel 워커 스레드에서 호출 — Application 프록시를 스레드 간 스트림으로 마샬링.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `excel_record_start`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

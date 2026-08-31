---
type: function
title: _remote_name
module: log_sync.py
lang: python
extraction: ast
signature: "(path)"
role: "서버에 쌓을 이름. 실행 중에 파일이 비워졌으면 .r1, .r2 … 로 갈아 쓴다."
role_source: docstring
version: "0.8.2"
loc: "log_sync.py:361-369"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "get"
  - "int"
  - "path"
  - "str"
called_by:
  - "_send_log_file"
reads:
  - "_STATE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
서버에 쌓을 이름. 실행 중에 파일이 비워졌으면 .r1, .r2 … 로 갈아 쓴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_send_log_file`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

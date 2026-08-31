---
type: function
title: _session_files
module: log_sync.py
lang: python
extraction: ast
signature: "()"
role: "이번 실행에서 새로 쓰인 로그 파일만 고른다(예전 실행의 잔재는 보내지 않는다)."
role_source: docstring
version: "0.8.2"
loc: "log_sync.py:267-298"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "append"
calls_external:
  - "Path"
  - "extra"
  - "folder"
  - "glob"
  - "is_dir"
  - "is_file"
  - "key"
  - "lower"
  - "path"
  - "pattern"
  - "set"
  - "stat"
  - "str"
called_by:
  - "tick"
reads:
  - "LOG_PATTERNS"
  - "MTIME_SLACK_SECONDS"
  - "_CONTEXT"
  - "_STATE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
이번 실행에서 새로 쓰인 로그 파일만 고른다(예전 실행의 잔재는 보내지 않는다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `append`
- 피호출(영향 전파 경로): `tick`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: function
title: _session_skills
module: log_sync.py
lang: python
extraction: ast
signature: "()"
role: "이번 실행 중에 만들어진 자동백업 스킬 zip (아직 쓰는 중인 파일은 다음 주기로 미룬다)."
role_source: docstring
version: "0.8.2"
loc: "log_sync.py:301-325"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "Path"
  - "folder"
  - "get"
  - "glob"
  - "is_dir"
  - "path"
  - "stat"
  - "str"
  - "time"
called_by:
  - "tick"
reads:
  - "MAX_SKILL_BYTES"
  - "MTIME_SLACK_SECONDS"
  - "SKILL_SETTLE_SECONDS"
  - "_CONTEXT"
  - "_STATE"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
이번 실행 중에 만들어진 자동백업 스킬 zip (아직 쓰는 중인 파일은 다음 주기로 미룬다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `tick`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

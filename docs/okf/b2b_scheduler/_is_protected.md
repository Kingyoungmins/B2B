---
type: function
title: _is_protected
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(name)"
role: "NTFS 는 대소문자를 구분하지 않으므로 'Cron.txt' 도 cron.txt 다 — 비교도 그렇게 한다."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:540-542"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "lower"
  - "str"
called_by:
  - "_folder_files"
  - "_read_schedule"
  - "register_schedule"
  - "update_files"
reads:
  - "_PROTECTED_FILES"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
NTFS 는 대소문자를 구분하지 않으므로 'Cron.txt' 도 cron.txt 다 — 비교도 그렇게 한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_folder_files`, `_read_schedule`, `register_schedule`, `update_files`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

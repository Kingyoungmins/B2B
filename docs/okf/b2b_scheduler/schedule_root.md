---
type: function
title: schedule_root
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "()"
role: "이 계정의 스케줄 보관 폴더 — 바탕화면\\ESTB\\<OS계정>."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:133-136"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "current_windows_user"
  - "desktop_dir"
  - "safe_component"
calls_external:
  - "get"
called_by:
  - "delete_schedule"
  - "list_schedules"
  - "register_schedule"
  - "update_files"
  - "update_schedule"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
이 계정의 스케줄 보관 폴더 — 바탕화면\ESTB\<OS계정>.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `current_windows_user`, `desktop_dir`, `safe_component`
- 피호출(영향 전파 경로): `delete_schedule`, `list_schedules`, `register_schedule`, `update_files`, `update_schedule`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

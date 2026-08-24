---
type: function
title: logic_backup_dir_info
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "serve_b2b.py:351-364"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "default_logic_backup_dir"
  - "logic_backup_dir"
  - "logic_backup_settings_path"
calls_external:
  - "exists"
  - "mkdir"
  - "path"
  - "str"
called_by:
  - "B2BHandler.do_GET"
  - "choose_logic_backup_dir_dialog"
  - "reset_logic_backup_dir"
  - "set_logic_backup_dir"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `default_logic_backup_dir`, `logic_backup_dir`, `logic_backup_settings_path`
- 피호출(영향 전파 경로): `B2BHandler.do_GET`, `choose_logic_backup_dir_dialog`, `reset_logic_backup_dir`, `set_logic_backup_dir`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

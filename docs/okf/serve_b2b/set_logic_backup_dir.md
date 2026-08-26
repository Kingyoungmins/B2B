---
type: function
title: set_logic_backup_dir
module: serve_b2b.py
lang: python
extraction: ast
signature: "(path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:368-384"

# ── 입출력 ──
inputs:
  - "path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises:
  - "ValueError"

# ── 유기적 관계 ──
calls:
  - "_load_user_settings"
  - "_save_user_settings"
  - "logic_backup_dir_info"
calls_external:
  - "Path"
  - "ValueError"
  - "chosen"
  - "expanduser"
  - "is_dir"
  - "mkdir"
  - "resolve"
  - "settings"
  - "str"
  - "unlink"
  - "uuid4"
  - "write_text"
called_by:
  - "choose_logic_backup_dir_dialog"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_load_user_settings`, `_save_user_settings`, `logic_backup_dir_info`
- 피호출(영향 전파 경로): `choose_logic_backup_dir_dialog`

## 실패/예외
- `ValueError`

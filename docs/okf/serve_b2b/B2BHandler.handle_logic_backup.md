---
type: method
title: B2BHandler.handle_logic_backup
module: serve_b2b.py
lang: python
extraction: ast
class: B2BHandler
signature: "(self)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.0"
loc: "serve_b2b.py:2093-2123"

# ── 입출력 ──
inputs:
  - "self"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises:
  - "ValueError"

# ── 유기적 관계 ──
calls:
  - "cleanup_logic_backups"
  - "logic_backup_dir"
  - "raw"
  - "read"
  - "safe_archive_filename"
  - "send_json"
calls_external:
  - "ValueError"
  - "endswith"
  - "err"
  - "exists"
  - "get"
  - "int"
  - "length"
  - "lower"
  - "mkdir"
  - "now"
  - "str"
  - "strftime"
  - "target_dir"
  - "target_path"
  - "unquote"
  - "uuid4"
  - "write_bytes"
called_by:
  - "B2BHandler.do_POST"
reads:
  - "self.headers"
  - "self.rfile"
  - "self.send_json"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `cleanup_logic_backups`, `logic_backup_dir`, `raw`, `read`, `safe_archive_filename`, `send_json`
- 피호출(영향 전파 경로): `B2BHandler.do_POST`

## 실패/예외
- `ValueError`

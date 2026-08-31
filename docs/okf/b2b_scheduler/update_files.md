---
type: function
title: update_files
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(payload)"
role: "등록된 스케줄의 스킬 파일을 교체/추가/삭제한다."
role_source: docstring
version: "0.8.2"
loc: "b2b_scheduler.py:556-662"

# ── 입출력 ──
inputs:
  - "payload"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls:
  - "_basename"
  - "_folder_files"
  - "_is_protected"
  - "append"
  - "safe_component"
  - "schedule_root"
  - "skill_docs_from_zip"
calls_external:
  - "b64decode"
  - "blob"
  - "d"
  - "data"
  - "dict"
  - "dumps"
  - "fname"
  - "get"
  - "incoming_docs"
  - "is_dir"
  - "is_file"
  - "isinstance"
  - "len"
  - "list"
  - "loads"
  - "next"
  - "now"
  - "r"
  - "read_text"
  - "root"
  - "sorted"
  - "str"
  - "strftime"
  - "unlink"
  - "write_bytes"
  - "write_text"
  - "x"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
등록된 스케줄의 스킬 파일을 교체/추가/삭제한다.

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: `_basename`, `_folder_files`, `_is_protected`, `append`, `safe_component`, `schedule_root`, `skill_docs_from_zip`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

---
type: function
title: cleanup_logic_backups
module: serve_b2b.py
lang: python
extraction: ast
signature: "(target_dir, keep=80)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "serve_b2b.py:1898-1911"

# ── 입출력 ──
inputs:
  - "target_dir"
  - "keep"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "glob"
  - "is_file"
  - "sorted"
  - "stat"
  - "target_dir"
  - "unlink"
called_by:
  - "B2BHandler.handle_logic_backup"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `B2BHandler.handle_logic_backup`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

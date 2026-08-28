---
type: function
title: _check_protection_loss
module: serve_b2b.py
lang: python
extraction: ast
signature: "(where, src_path, out_path, **extra)"
role: "원본은 보호돼 있었는데 결과물이 아니면 **그 자리에서** 크게 남긴다."
role_source: docstring
version: "0.8.1"
loc: "serve_b2b.py:3916-3941"

# ── 입출력 ──
inputs:
  - "where"
  - "src_path"
  - "out_path"
  - "**extra"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_file_label_evidence"
  - "_protection_rank"
  - "_vba_trace"
calls_external:
  - "extra"
  - "get"
  - "out_path"
  - "src_path"
  - "where"
called_by:
  - "_save_excel_session_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
원본은 보호돼 있었는데 결과물이 아니면 **그 자리에서** 크게 남긴다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_file_label_evidence`, `_protection_rank`, `_vba_trace`
- 피호출(영향 전파 경로): `_save_excel_session_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

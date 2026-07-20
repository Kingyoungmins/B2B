---
type: function
title: _b2b_runner_trusted_dir
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "러너 .xlsm 를 만들 고정 폴더(Excel 신뢰 위치로 등록되는 곳)."
role_source: docstring
version: "0.5.19"
loc: "serve_b2b.py:3752-3759"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "gettempdir"
  - "mkdir"
called_by:
  - "_create_vba_runner_workbook"
  - "_ensure_runner_trusted_location"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
러너 .xlsm 를 만들 고정 폴더(Excel 신뢰 위치로 등록되는 곳).

## 사이드이펙트 & 주의
- 파일시스템 변경/IO

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_create_vba_runner_workbook`, `_ensure_runner_trusted_location`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

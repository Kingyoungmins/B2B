---
type: function
title: _zip_entry_names
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "(zf)"
role: "앱이 만든 zip 은 UTF-8 플래그가 없어도 바이트는 UTF-8 이다."
role_source: docstring
version: "0.8.1"
loc: "b2b_scheduler.py:441-452"

# ── 입출력 ──
inputs:
  - "zf"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "decode"
  - "encode"
  - "infolist"
called_by:
  - "skill_docs_from_zip"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
앱이 만든 zip 은 UTF-8 플래그가 없어도 바이트는 UTF-8 이다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `skill_docs_from_zip`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

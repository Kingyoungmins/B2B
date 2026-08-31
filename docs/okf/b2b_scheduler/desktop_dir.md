---
type: function
title: desktop_dir
module: b2b_scheduler.py
lang: python
extraction: ast
signature: "()"
role: "바탕화면 실제 경로. OneDrive 리디렉션이 흔해서 셸에 물어보는 쪽이 정확하다."
role_source: docstring
version: "0.8.2"
loc: "b2b_scheduler.py:82-91"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Path"
  - "SHGetFolderPathW"
  - "buf"
  - "create_unicode_buffer"
  - "get"
  - "home"
called_by:
  - "schedule_root"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
바탕화면 실제 경로. OneDrive 리디렉션이 흔해서 셸에 물어보는 쪽이 정확하다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `schedule_root`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

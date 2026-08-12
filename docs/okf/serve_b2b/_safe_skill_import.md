---
type: function
title: _safe_skill_import
module: serve_b2b.py
lang: python
extraction: ast
signature: "(name, globals=None, locals=None, fromlist=(), level=0)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:16221-16231"

# ── 입출력 ──
inputs:
  - "name"
  - "globals"
  - "locals"
  - "fromlist"
  - "level"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises:
  - "ImportError"

# ── 유기적 관계 ──
calls: []
calls_external:
  - "ImportError"
  - "_SKILL_ALLOWED_IMPORTS"
  - "import_module"
  - "join"
  - "name"
  - "sorted"
  - "split"
  - "str"
called_by: []
reads:
  - "_SKILL_ALLOWED_IMPORTS"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `ImportError`

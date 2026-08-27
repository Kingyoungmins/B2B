---
type: function
title: _resolve_live_identity_name
module: serve_b2b.py
lang: python
extraction: ast
signature: "(session_name, incoming_name, path_name)"
role: "결과/스냅샷을 '같은 라이브 세션'에 교체-로드(result-edit / 스냅샷 복원)할 때, 라이브 워크북이"
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:6418-6433"

# ── 입출력 ──
inputs:
  - "session_name"
  - "incoming_name"
  - "path_name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_clean_session_workbook_name"
calls_external: []
called_by:
  - "_replace_excel_session_workbook_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
결과/스냅샷을 '같은 라이브 세션'에 교체-로드(result-edit / 스냅샷 복원)할 때, 라이브 워크북이

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_clean_session_workbook_name`
- 피호출(영향 전파 경로): `_replace_excel_session_workbook_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

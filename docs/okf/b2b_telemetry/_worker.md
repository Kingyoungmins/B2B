---
type: function
title: _worker
module: b2b_telemetry.py
lang: python
extraction: ast
signature: "()"
role: "══════════════════════════════════════════════════════════════════════════"
role_source: banner
version: "0.8.1"
loc: "b2b_telemetry.py:343-363"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_write_preview"
calls_external:
  - "event"
  - "get"
  - "sender"
  - "task_done"
called_by:
  - "_spawn_dialog_confirmer"
  - "init"
reads:
  - "_state"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
══════════════════════════════════════════════════════════════════════════

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_write_preview`
- 피호출(영향 전파 경로): `_spawn_dialog_confirmer`, `init`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

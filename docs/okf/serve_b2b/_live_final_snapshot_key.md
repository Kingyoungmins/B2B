---
type: function
title: _live_final_snapshot_key
module: serve_b2b.py
lang: python
extraction: ast
signature: "(wb_record, state_sig)"
role: "키 = 원본 파일 지문 + 클라가 계산한 파이프라인 상태 서명."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:19526-19537"

# ── 입출력 ──
inputs:
  - "wb_record"
  - "state_sig"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_workbook_fingerprint"
  - "raw"
calls_external:
  - "dumps"
  - "encode"
  - "hexdigest"
  - "payload"
  - "sha256"
  - "str"
  - "wb_record"
called_by:
  - "_find_live_final_snapshot"
  - "_save_live_final_snapshot"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
키 = 원본 파일 지문 + 클라가 계산한 파이프라인 상태 서명.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_workbook_fingerprint`, `raw`
- 피호출(영향 전파 경로): `_find_live_final_snapshot`, `_save_live_final_snapshot`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

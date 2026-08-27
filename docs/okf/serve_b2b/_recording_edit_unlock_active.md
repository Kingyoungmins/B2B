---
type: function
title: _recording_edit_unlock_active
module: serve_b2b.py
lang: python
extraction: ast
signature: "(app=None)"
role: "녹화 편집 모드 중이고 대상이 라이브 공유 인스턴스면 True(잠금 적용을 건너뛴다)."
role_source: docstring
version: "0.8.0"
loc: "serve_b2b.py:3599-3610"

# ── 입출력 ──
inputs:
  - "app"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_is_live_shared_app"
calls_external:
  - "app"
called_by:
  - "_configure_excel_grid_window"
  - "_configure_read_only_mirror_input_block"
  - "_disable_excel_context_menus"
  - "_protect_workbook_for_read_only_mirror"
reads:
  - "RECORDING_EDIT_UNLOCKED"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
녹화 편집 모드 중이고 대상이 라이브 공유 인스턴스면 True(잠금 적용을 건너뛴다).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_is_live_shared_app`
- 피호출(영향 전파 경로): `_configure_excel_grid_window`, `_configure_read_only_mirror_input_block`, `_disable_excel_context_menus`, `_protect_workbook_for_read_only_mirror`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

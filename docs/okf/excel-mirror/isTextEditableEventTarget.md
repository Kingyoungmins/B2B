---
type: endpoint
title: isTextEditableEventTarget
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(t)"
role: "[입력 지연/IME 제보 2026-08-20] 채팅 등 텍스트 입력 대상인가 — 타이핑 중 Excel 창 조작 억제용."
role_source: banner
version: "0.7.4"
loc: "excel-mirror.js:2033-2033"

# ── 입출력 ──
inputs:
  - "t"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "includes"
  - "toLowerCase"
  - "toUpperCase"
called_by:
  - "installExcelMirrorPositionListeners"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[입력 지연/IME 제보 2026-08-20] 채팅 등 텍스트 입력 대상인가 — 타이핑 중 Excel 창 조작 억제용.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `installExcelMirrorPositionListeners`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

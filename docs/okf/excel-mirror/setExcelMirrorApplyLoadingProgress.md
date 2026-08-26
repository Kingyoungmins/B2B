---
type: endpoint
title: setExcelMirrorApplyLoadingProgress
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "기본 문구는 그대로 두고 접미만 바꾸므로 중첩 잠금에서도 바깥 문구가 사라지지 않는다."
role_source: banner
version: "0.8.0"
loc: "excel-mirror.js:1514-1514"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: excelMirror.applyLoadingProgress"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
called_by:
  - "_ensureExcelCancelButton"
  - "_setOverlayProgress"
  - "beginExcelMirrorApplyLoading"
reads: []
writes:
  - "excelMirror.applyLoadingProgress"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
기본 문구는 그대로 두고 접미만 바꾸므로 중첩 잠금에서도 바깥 문구가 사라지지 않는다.

## 사이드이펙트 & 주의
- 상태 변경: excelMirror.applyLoadingProgress
- 변경 상태 `excelMirror.applyLoadingProgress` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_ensureExcelCancelButton`, `_setOverlayProgress`, `beginExcelMirrorApplyLoading`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

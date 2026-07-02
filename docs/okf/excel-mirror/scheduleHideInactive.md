---
type: endpoint
title: scheduleHideInactive
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(delay = 180)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "excel-mirror.js:2006-2006"

# ── 입출력 ──
inputs:
  - "delay = 180"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
  - "상태 변경: excelMirror.hideTimer"
  - "타이머"
raises: []

# ── 유기적 관계 ──
calls:
  - "clearHideTimer"
  - "hideInactive"
calls_external:
  - "setTimeout"
called_by:
  - "installOverlayAutoHide"
reads: []
writes:
  - "excelMirror.hideTimer"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작
- 상태 변경: excelMirror.hideTimer
- 타이머
- 변경 상태 `excelMirror.hideTimer` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `clearHideTimer`, `hideInactive`
- 피호출(영향 전파 경로): `installOverlayAutoHide`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

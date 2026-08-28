---
type: endpoint
title: setUiBusySuffix
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "빈 값이면 보조 상태만 지운다."
role_source: banner
version: "0.8.1"
loc: "excel-mirror.js:254-254"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_uiBusyRender"
calls_external:
  - "String"
called_by:
  - "_reapplyVbaPipelineToLiveImpl"
  - "_reportProgress"
  - "_setOverlayProgress"
  - "preopenAllExcelMirrors"
  - "secureDocNotice"
  - "secureDocNoticeHide"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
빈 값이면 보조 상태만 지운다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_uiBusyRender`
- 피호출(영향 전파 경로): `_reapplyVbaPipelineToLiveImpl`, `_reportProgress`, `_setOverlayProgress`, `preopenAllExcelMirrors`, `secureDocNotice`, `secureDocNoticeHide`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

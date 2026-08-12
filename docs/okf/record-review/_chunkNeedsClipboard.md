---
type: endpoint
title: _chunkNeedsClipboard
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "[클립보드 원자성] 조각이 붙여넣기(Paste/PasteSpecial)로 시작하는데 같은 조각 안에 선행"
role_source: banner
version: "0.7.3"
loc: "record-review.js:557-557"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Paste"
  - "String"
  - "search"
called_by:
  - "llmSplitRecordedVba"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[클립보드 원자성] 조각이 붙여넣기(Paste/PasteSpecial)로 시작하는데 같은 조각 안에 선행

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `llmSplitRecordedVba`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

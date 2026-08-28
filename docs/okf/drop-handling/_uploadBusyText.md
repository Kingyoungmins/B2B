---
type: endpoint
title: _uploadBusyText
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(job, done, name)"
role: "[사용자 지시 2026-08-26] 진행 알림은 '화면 잠금' 한 곳으로. 예전엔 잠금 오버레이"
role_source: banner
version: "0.8.1"
loc: "drop-handling.js:45-45"

# ── 입출력 ──
inputs:
  - "job"
  - "done"
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Number"
  - "max"
  - "min"
called_by:
  - "beginUpload"
  - "updateUpload"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[사용자 지시 2026-08-26] 진행 알림은 '화면 잠금' 한 곳으로. 예전엔 잠금 오버레이

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `beginUpload`, `updateUpload`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

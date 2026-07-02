---
type: endpoint
title: stepNumFromName
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(name)"
role: "보조: 파일명에서 step 번호 힌트 추출. \"foo_step_3.js\" 또는 \"step3.js\" 모두 OK."
role_source: banner
version: "0.5.18"
loc: "save-load.js:532-532"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "exec"
  - "parseInt"
called_by:
  - "loadLogicFiles"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
보조: 파일명에서 step 번호 힌트 추출. "foo_step_3.js" 또는 "step3.js" 모두 OK.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `loadLogicFiles`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

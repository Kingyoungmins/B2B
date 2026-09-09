---
type: endpoint
title: revealKey
module: version-gate.js
lang: js
extraction: regex   # 정규식 근사
signature: "(e)"
role: "F2 = 숨겨둔 [무시하고 사용하기] 표시. 팝업이 떠 있는 동안만 듣고, 닫히면 정리한다."
role_source: banner
version: "0.8.4"
loc: "version-gate.js:81-81"

# ── 입출력 ──
inputs:
  - "e"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "preventDefault"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
F2 = 숨겨둔 [무시하고 사용하기] 표시. 팝업이 떠 있는 동안만 듣고, 닫히면 정리한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

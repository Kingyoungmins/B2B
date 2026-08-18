---
type: endpoint
title: _looksLikeCorrection
module: llm-api.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[#3/#12] 사용자의 최신 메시지가 직전 결과에 대한 '정정'인지 추정(정정일 때만 정정-우선 지시 강화)."
role_source: banner
version: "0.7.4"
loc: "llm-api.js:15-15"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "test"
called_by:
  - "callLLM"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[#3/#12] 사용자의 최신 메시지가 직전 결과에 대한 '정정'인지 추정(정정일 때만 정정-우선 지시 강화).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `callLLM`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

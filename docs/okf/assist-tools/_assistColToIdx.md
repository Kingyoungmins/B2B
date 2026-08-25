---
type: endpoint
title: _assistColToIdx
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(col)"
role: "── 13. [범용 읽기] 아무 파일/시트의 원시 범위 읽기 ──────────────────────────"
role_source: banner
version: "0.8.0"
loc: "assist-tools.js:499-499"

# ── 입출력 ──
inputs:
  - "col"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "charCodeAt"
  - "toUpperCase"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
── 13. [범용 읽기] 아무 파일/시트의 원시 범위 읽기 ──────────────────────────

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

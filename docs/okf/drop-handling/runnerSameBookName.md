---
type: endpoint
title: runnerSameBookName
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(a, b)"
role: "같은 워크북 이름인가. 실행기 매핑은 확장자/공백 표기가 조금씩 다른 파일을 다루므로"
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:1895-1895"

# ── 입출력 ──
inputs:
  - "a"
  - "b"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "norm"
calls_external:
  - "String"
  - "replace"
  - "stem"
  - "toLowerCase"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
같은 워크북 이름인가. 실행기 매핑은 확장자/공백 표기가 조금씩 다른 파일을 다루므로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `norm`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

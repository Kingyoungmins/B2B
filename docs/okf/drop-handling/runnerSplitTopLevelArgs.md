---
type: endpoint
title: runnerSplitTopLevelArgs
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(callText)"
role: "여는 괄호 위치(openIdx)에서 짝이 맞는 닫는 괄호까지 = '그 호출의 인자 목록'만 반환."
role_source: banner
version: "0.8.0"
loc: "drop-handling.js:825-825"

# ── 입출력 ──
inputs:
  - "callText"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "push"
calls_external:
  - "String"
  - "trim"
called_by:
  - "runnerExtractGeneratedSheetsFromCode"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
여는 괄호 위치(openIdx)에서 짝이 맞는 닫는 괄호까지 = '그 호출의 인자 목록'만 반환.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): `runnerExtractGeneratedSheetsFromCode`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

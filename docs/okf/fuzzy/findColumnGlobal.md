---
type: endpoint
title: findColumnGlobal
module: fuzzy.js
lang: js
extraction: regex   # 정규식 근사
signature: "(inputsMap, name)"
role: "전체 inputs 안에서 같은 컬럼명을 가진 (file, sheet, colIdx) 튜플 찾기"
role_source: banner
version: "0.5.18"
loc: "fuzzy.js:199-199"

# ── 입출력 ──
inputs:
  - "inputsMap"
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "col"
  - "push"
calls_external:
  - "forEach"
  - "keys"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
전체 inputs 안에서 같은 컬럼명을 가진 (file, sheet, colIdx) 튜플 찾기

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `col`, `push`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

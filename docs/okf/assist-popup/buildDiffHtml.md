---
type: endpoint
title: buildDiffHtml
module: assist-popup.js
lang: js
extraction: regex   # 정규식 근사
signature: "(oldCode, newCode)"
role: "[검토 #10] 같은 줄번호끼리 비교하면 줄 하나 삽입에도 이후 전체가 어긋난 diff 로 보였다(승인 근거"
role_source: banner
version: "0.8.0"
loc: "assist-popup.js:77-77"

# ── 입출력 ──
inputs:
  - "oldCode"
  - "newCode"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "esc"
  - "push"
calls_external:
  - "String"
  - "forEach"
  - "join"
  - "slice"
  - "split"
called_by:
  - "proposalBody"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[검토 #10] 같은 줄번호끼리 비교하면 줄 하나 삽입에도 이후 전체가 어긋난 diff 로 보였다(승인 근거

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `esc`, `push`
- 피호출(영향 전파 경로): `proposalBody`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

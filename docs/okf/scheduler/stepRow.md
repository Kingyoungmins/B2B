---
type: endpoint
title: stepRow
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "(cls, badge, title, sub, tail)"
role: "단계 표식은 동그라미 숫자 하나로 끝낸다. 번호 글자와 이모지를 나란히 두면"
role_source: banner
version: "0.8.2"
loc: "scheduler.js:279-279"

# ── 입출력 ──
inputs:
  - "cls"
  - "badge"
  - "title"
  - "sub"
  - "tail"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "viewGroup2"
  - "viewStep1"
  - "viewStep2"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
단계 표식은 동그라미 숫자 하나로 끝낸다. 번호 글자와 이모지를 나란히 두면

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `viewGroup2`, `viewStep1`, `viewStep2`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

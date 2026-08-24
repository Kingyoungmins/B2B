---
type: endpoint
title: clip
module: record-review.js
lang: js
extraction: regex   # 정규식 근사
signature: "(s, n)"
role: "설명이 길면(예: \"서식 (1~40/214스텝) — 서식: 요약!A1 → …\") 카드가 글자벽이 돼 읽기 어렵다."
role_source: banner
version: "0.7.5"
loc: "record-review.js:365-365"

# ── 입출력 ──
inputs:
  - "s"
  - "n"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "slice"
called_by:
  - "showRecordReviewDialog"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
설명이 길면(예: "서식 (1~40/214스텝) — 서식: 요약!A1 → …") 카드가 글자벽이 돼 읽기 어렵다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `showRecordReviewDialog`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

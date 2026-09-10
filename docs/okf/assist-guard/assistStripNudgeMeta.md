---
type: endpoint
title: assistStripNudgeMeta
module: assist-guard.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "history 에 남아 다음 턴까지 사과 톤을 끌고 갔다(실측 2026-09-10 17:13). 그런 문장만 걷어낸다 — 내용 문장은 건드리지 않는다."
role_source: banner
version: "0.8.4"
loc: "assist-guard.js:17-17"

# ── 입출력 ──
inputs:
  - "text"
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
  - "filter"
  - "join"
  - "split"
  - "test"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
history 에 남아 다음 턴까지 사과 톤을 끌고 갔다(실측 2026-09-10 17:13). 그런 문장만 걷어낸다 — 내용 문장은 건드리지 않는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `push`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

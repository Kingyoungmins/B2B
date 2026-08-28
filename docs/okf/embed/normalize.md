---
type: endpoint
title: normalize
module: embed.js
lang: js
extraction: regex   # 정규식 근사
signature: "(raw)"
role: "사용자가 host:port 만 적어도 동작하게 한다."
role_source: banner
version: "0.8.1"
loc: "embed.js:30-30"

# ── 입출력 ──
inputs:
  - "raw"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "URL"
  - "test"
  - "trim"
called_by:
  - "bind"
  - "load"
  - "sendChat"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
사용자가 host:port 만 적어도 동작하게 한다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `bind`, `load`, `sendChat`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

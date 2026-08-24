---
type: endpoint
title: ixiFailoverUpstreams
module: config.js
lang: js
extraction: regex   # 정규식 근사
signature: "(currentUpstream)"
role: "사용자가 지정한 서버를 우리 목록으로 덮어쓰면 안 된다."
role_source: banner
version: "0.7.4"
loc: "config.js:398-398"

# ── 입출력 ──
inputs:
  - "currentUpstream"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "getIxiServerPresetId"
  - "push"
calls_external:
  - "String"
  - "forEach"
  - "indexOf"
  - "replace"
  - "trim"
called_by:
  - "fetchOpenAICompat"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
사용자가 지정한 서버를 우리 목록으로 덮어쓰면 안 된다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `getIxiServerPresetId`, `push`
- 피호출(영향 전파 경로): `fetchOpenAICompat`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

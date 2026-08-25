---
type: endpoint
title: assistCallSignature
module: assist-guard.js
lang: js
extraction: regex   # 정규식 근사
signature: "(action, args)"
role: "같은 (도구,인자) 반복 호출 감지 — 압축으로 앞 라운드를 잊고 같은 조회를 되풀이하는 것 방지"
role_source: banner
version: "0.8.0"
loc: "assist-guard.js:131-131"

# ── 입출력 ──
inputs:
  - "action"
  - "args"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "stringify"
called_by:
  - "assistHandleUserMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
같은 (도구,인자) 반복 호출 감지 — 압축으로 앞 라운드를 잊고 같은 조회를 되풀이하는 것 방지

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `assistHandleUserMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

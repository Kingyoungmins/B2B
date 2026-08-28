---
type: endpoint
title: loadTrace
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "(docName, file)"
role: "규격이 정해지면 이 함수 안에서만 해석을 붙이면 된다(화면·상태는 그대로)."
role_source: banner
version: "0.8.1"
loc: "scheduler.js:604-604"

# ── 입출력 ──
inputs:
  - "docName"
  - "file"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: error"
raises: []

# ── 유기적 관계 ──
calls:
  - "render"
calls_external:
  - "Number"
  - "set"
called_by:
  - "bind"
reads:
  - "state.error"
  - "state.traces"
writes:
  - "error"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
규격이 정해지면 이 함수 안에서만 해석을 붙이면 된다(화면·상태는 그대로).

## 사이드이펙트 & 주의
- 상태 변경: error
- 변경 상태 `error` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `render`
- 피호출(영향 전파 경로): `bind`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

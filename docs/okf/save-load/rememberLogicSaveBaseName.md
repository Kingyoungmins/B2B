---
type: endpoint
title: rememberLogicSaveBaseName
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(name)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.18"
loc: "save-load.js:101-101"

# ── 입출력 ──
inputs:
  - "name"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "localStorage/세션스토리지 접근"
  - "상태 변경: logicSaveBaseName"
raises: []

# ── 유기적 관계 ──
calls:
  - "stripLogicTimestampSuffix"
calls_external:
  - "setItem"
called_by:
  - "loadLogic"
  - "openSaveModal"
reads:
  - "state.logicSaveBaseName"
writes:
  - "logicSaveBaseName"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.18-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- localStorage/세션스토리지 접근
- 상태 변경: logicSaveBaseName
- 변경 상태 `logicSaveBaseName` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `stripLogicTimestampSuffix`
- 피호출(영향 전파 경로): `loadLogic`, `openSaveModal`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

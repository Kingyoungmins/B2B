---
type: endpoint
title: loadLogicFiles
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(files)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "save-load.js:497-497"

# ── 입출력 ──
inputs:
  - "files"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "add"
  - "loadLogic"
  - "normalizeLoadedFiles"
  - "normalizeLoadedLogicCode"
  - "similarity"
  - "stepNumFromName"
  - "uid"
calls_external:
  - "Error"
  - "Set"
  - "endsWith"
  - "exec"
  - "filter"
  - "found"
  - "has"
  - "isArray"
  - "map"
  - "parse"
  - "parseInt"
  - "replace"
  - "startsWith"
  - "test"
  - "text"
  - "toLowerCase"
called_by:
  - "openLoadDialog"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `add`, `loadLogic`, `normalizeLoadedFiles`, `normalizeLoadedLogicCode`, `similarity`, `stepNumFromName`, `uid`
- 피호출(영향 전파 경로): `openLoadDialog`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

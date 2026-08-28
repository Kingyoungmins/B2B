---
type: endpoint
title: _assistRefreshLiveFile
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(f, sheet)"
role: "[라이브 캐시 갱신] AI 도움 data 도구는 state.inputs 미리보기 캐시만 읽는다. 파이프라인이"
role_source: banner
version: "0.8.1"
loc: "assist-tools.js:46-46"

# ── 입출력 ──
inputs:
  - "f"
  - "sheet"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "applyLiveSchemaToFileCache"
  - "getFile"
  - "postExcelMirror"
calls_external:
  - "String"
  - "entries"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
[라이브 캐시 갱신] AI 도움 data 도구는 state.inputs 미리보기 캐시만 읽는다. 파이프라인이

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `applyLiveSchemaToFileCache`, `getFile`, `postExcelMirror`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

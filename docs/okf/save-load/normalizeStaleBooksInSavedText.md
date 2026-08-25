---
type: endpoint
title: normalizeStaleBooksInSavedText
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "[저장 시] 위와 같은 교정을 '현재 업로드' 기준으로 — stale 파일명이 유일 재해석될 때만."
role_source: banner
version: "0.8.0"
loc: "save-load.js:865-865"

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
  - "_replaceStaleBookNamesInText"
  - "getFile"
  - "pipelineResolveSavedTargetFileId"
calls_external:
  - "String"
  - "slice"
  - "startsWith"
  - "trim"
called_by:
  - "_buildLogicZipEntriesImpl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[저장 시] 위와 같은 교정을 '현재 업로드' 기준으로 — stale 파일명이 유일 재해석될 때만.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_replaceStaleBookNamesInText`, `getFile`, `pipelineResolveSavedTargetFileId`
- 피호출(영향 전파 경로): `_buildLogicZipEntriesImpl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

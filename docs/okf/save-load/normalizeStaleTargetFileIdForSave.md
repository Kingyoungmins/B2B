---
type: endpoint
title: normalizeStaleTargetFileIdForSave
module: save-load.js
lang: js
extraction: regex   # 정규식 근사
signature: "(targetFileId)"
role: "[저장 시] 현재 업로드에 없는(stale) targetFileId 만, 기존 4단계 유일 매칭(안정키 포함)으로"
role_source: banner
version: "0.7.4"
loc: "save-load.js:732-732"

# ── 입출력 ──
inputs:
  - "targetFileId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "getFile"
  - "pipelineResolveSavedTargetFileId"
calls_external:
  - "String"
  - "startsWith"
called_by:
  - "_buildLogicZipEntriesImpl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[저장 시] 현재 업로드에 없는(stale) targetFileId 만, 기존 4단계 유일 매칭(안정키 포함)으로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `getFile`, `pipelineResolveSavedTargetFileId`
- 피호출(영향 전파 경로): `_buildLogicZipEntriesImpl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

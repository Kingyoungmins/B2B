---
type: endpoint
title: parseFile
module: file-parsing.js
lang: js
extraction: regex   # 정규식 근사
signature: "(file)"
role: "==================================================================="
role_source: banner
version: "0.8.2"
loc: "file-parsing.js:4-4"

# ── 입출력 ──
inputs:
  - "file"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "canUseParseWorker"
  - "parseFileInWorker"
  - "parseFileOnMainThread"
calls_external:
  - "warn"
called_by:
  - "loadInputFiles"
  - "loadOutputTemplates"
  - "parseFileWithBackendPreview"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
===================================================================

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `canUseParseWorker`, `parseFileInWorker`, `parseFileOnMainThread`
- 피호출(영향 전파 경로): `loadInputFiles`, `loadOutputTemplates`, `parseFileWithBackendPreview`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

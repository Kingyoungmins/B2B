---
type: endpoint
title: autoOpenMirrorAfterUpload
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(selectedFileId)"
role: "호환용 진입점: 업로드 직후에는 현재 파일만 열어 화면 순회/깜빡임을 막는다."
role_source: banner
version: "0.8.1"
loc: "excel-mirror.js:791-791"

# ── 입출력 ──
inputs:
  - "selectedFileId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "preopenAllExcelMirrors"
calls_external: []
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
호환용 진입점: 업로드 직후에는 현재 파일만 열어 화면 순회/깜빡임을 막는다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `preopenAllExcelMirrors`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

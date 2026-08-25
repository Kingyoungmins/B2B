---
type: endpoint
title: _fail
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(reason, err)"
role: "[전환 침묵 실패 금지] 실측(12:52): 재현 실패 직후 탭 클릭 15회가 전부 40ms 만에 조용히"
role_source: banner
version: "0.8.0"
loc: "excel-mirror.js:736-736"

# ── 입출력 ──
inputs:
  - "reason"
  - "err"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "toast"
  - "traceClientUiEvent"
  - "updateMirrorShellStatus"
calls_external:
  - "String"
  - "slice"
called_by:
  - "switchVisibleExcelMirrorToFileId"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[전환 침묵 실패 금지] 실측(12:52): 재현 실패 직후 탭 클릭 15회가 전부 40ms 만에 조용히

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `toast`, `traceClientUiEvent`, `updateMirrorShellStatus`
- 피호출(영향 전파 경로): `switchVisibleExcelMirrorToFileId`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

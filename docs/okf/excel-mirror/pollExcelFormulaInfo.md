---
type: endpoint
title: pollExcelFormulaInfo
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(excelId)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.2"
loc: "excel-mirror.js:1877-1877"

# ── 입출력 ──
inputs:
  - "excelId"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
  - "상태 변경: excelMirror.formulaPolling"
raises: []

# ── 유기적 관계 ──
calls:
  - "postExcelMirror"
  - "updateMirrorShellStatus"
calls_external: []
called_by:
  - "startExcelMirrorPolling"
reads: []
writes:
  - "excelMirror.formulaPolling"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 네트워크/서버 호출
- 상태 변경: excelMirror.formulaPolling
- 변경 상태 `excelMirror.formulaPolling` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `postExcelMirror`, `updateMirrorShellStatus`
- 피호출(영향 전파 경로): `startExcelMirrorPolling`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

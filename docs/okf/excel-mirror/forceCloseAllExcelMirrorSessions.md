---
type: endpoint
title: forceCloseAllExcelMirrorSessions
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "초기화(전부 폐기)용 강제 정리: graceful 닫기(워크북별 wb.Close, 대형 파일은 건당 수 초 +"
role_source: banner
version: "0.8.0"
loc: "excel-mirror.js:1140-1140"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "clearExcelMirrorClientState"
  - "isMissingExcelSessionError"
  - "postExcelMirror"
calls_external:
  - "warn"
called_by:
  - "softRefreshApp"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
초기화(전부 폐기)용 강제 정리: graceful 닫기(워크북별 wb.Close, 대형 파일은 건당 수 초 +

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `clearExcelMirrorClientState`, `isMissingExcelSessionError`, `postExcelMirror`
- 피호출(영향 전파 경로): `softRefreshApp`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

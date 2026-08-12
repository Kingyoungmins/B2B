---
type: endpoint
title: _lazyFail
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(kind, err)"
role: "[전환 침묵 실패 금지] 세션이 죽어 매핑이 forget 된 파일 탭을 클릭하면 재오픈(ensure)로"
role_source: banner
version: "0.7.3"
loc: "excel-mirror.js:2039-2039"

# ── 입출력 ──
inputs:
  - "kind"
  - "err"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "isMissingExcelSessionError"
  - "toast"
  - "traceClientUiEvent"
  - "updateMirrorShellStatus"
calls_external:
  - "String"
  - "slice"
  - "warn"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
[전환 침묵 실패 금지] 세션이 죽어 매핑이 forget 된 파일 탭을 클릭하면 재오픈(ensure)로

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `isMissingExcelSessionError`, `toast`, `traceClientUiEvent`, `updateMirrorShellStatus`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

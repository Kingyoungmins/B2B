---
type: endpoint
title: _assistFetchLiveRows
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(f, sheet, maxRows)"
role: "큰 상한으로 다시 읽어 돌려준다. 캐시(f.sheets)엔 넣지 않는다 — 생성 프롬프트의 미리보기가 커지면 안 된다."
role_source: banner
version: "0.8.4"
loc: "assist-tools.js:74-74"

# ── 입출력 ──
inputs:
  - "f"
  - "sheet"
  - "maxRows"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "네트워크/서버 호출"
raises: []

# ── 유기적 관계 ──
calls:
  - "getFile"
  - "postExcelMirror"
calls_external:
  - "Number"
  - "String"
  - "entries"
  - "isArray"
  - "max"
  - "min"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
큰 상한으로 다시 읽어 돌려준다. 캐시(f.sheets)엔 넣지 않는다 — 생성 프롬프트의 미리보기가 커지면 안 된다.

## 사이드이펙트 & 주의
- 네트워크/서버 호출

## 관계
- 호출: `getFile`, `postExcelMirror`
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

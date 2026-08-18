---
type: endpoint
title: publishNativeRunnerMode
module: excel-mirror.js
lang: js
extraction: regex   # 정규식 근사
signature: "(isRunner)"
role: "[0.5.16 #1] 실행기(runner)는 헤드리스 — 네이티브 셸의 우측 패널(파일탭+Excel 영역)을 접어 WebView 가"
role_source: banner
version: "0.7.4"
loc: "excel-mirror.js:68-68"

# ── 입출력 ──
inputs:
  - "isRunner"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "DOM/브라우저 전역 조작"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "join"
  - "postMessage"
called_by:
  - "setPage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[0.5.16 #1] 실행기(runner)는 헤드리스 — 네이티브 셸의 우측 패널(파일탭+Excel 영역)을 접어 WebView 가

## 사이드이펙트 & 주의
- DOM/브라우저 전역 조작

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `setPage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

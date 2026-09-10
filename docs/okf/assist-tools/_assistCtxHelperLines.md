---
type: endpoint
title: _assistCtxHelperLines
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "()"
role: "── [2026-09-10] ctx 헬퍼 설명서 조회 — 코드 수정 제안 전에 '그 함수가 진짜 있나' 확인용 ──────────"
role_source: banner
version: "0.8.4"
loc: "assist-tools.js:278-278"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "filter"
  - "map"
  - "split"
  - "test"
  - "trim"
called_by: []
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.4-gen"
---

## 역할
── [2026-09-10] ctx 헬퍼 설명서 조회 — 코드 수정 제안 전에 '그 함수가 진짜 있나' 확인용 ──────────

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

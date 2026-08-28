---
type: endpoint
title: _cfgNames
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(f)"
role: "name(실제 업로드명)과 displayName(사용자 편집 표시명) 둘 다 매칭 허용 — 표시명 편집된"
role_source: banner
version: "0.8.1"
loc: "drop-handling.js:723-723"

# ── 입출력 ──
inputs:
  - "f"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external: []
called_by:
  - "runnerApplyEnvConfigFilter"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
name(실제 업로드명)과 displayName(사용자 편집 표시명) 둘 다 매칭 허용 — 표시명 편집된

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `runnerApplyEnvConfigFilter`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

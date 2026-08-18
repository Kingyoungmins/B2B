---
type: endpoint
title: mappings
module: assist-tools.js
lang: js
extraction: regex   # 정규식 근사
signature: "(()"
role: "[감사 G1] 실행기 '파일확인' 매핑(스킬 요구파일 → 실제 업로드 파일/시트) — 이전엔 어떤 도구도"
role_source: banner
version: "0.7.4"
loc: "assist-tools.js:542-542"

# ── 입출력 ──
inputs:
  - "("
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "keys"
  - "replace"
  - "slice"
called_by: []
reads:
  - "state.runnerMappings"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[감사 G1] 실행기 '파일확인' 매핑(스킬 요구파일 → 실제 업로드 파일/시트) — 이전엔 어떤 도구도

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`

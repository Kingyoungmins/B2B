---
type: endpoint
title: decimalSplitNumberExtractFailures
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "[소수점 쪼개기 차단] re.findall(r'\\d+') 류 '연속 숫자만' 패턴 + 콤마 join 조합은 '20.0' 을"
role_source: banner
version: "0.7.5"
loc: "chat-ui.js:650-650"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "bfind"
  - "test"
called_by:
  - "validateAssistantCodeBeforeApply"
  - "wholeColumnCountRowTwoFailures"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
[소수점 쪼개기 차단] re.findall(r'\d+') 류 '연속 숫자만' 패턴 + 콤마 join 조합은 '20.0' 을

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `validateAssistantCodeBeforeApply`, `wholeColumnCountRowTwoFailures`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

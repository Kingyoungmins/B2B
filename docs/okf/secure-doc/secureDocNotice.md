---
type: endpoint
title: secureDocNotice
module: secure-doc.js
lang: js
extraction: regex   # 정규식 근사
signature: "(msg)"
role: "업로드 중 다운로드같이 겹쳐도 먼저 끝난 쪽이 배너를 꺼버리지 않게 카운터로 센다."
role_source: banner
version: "0.8.0"
loc: "secure-doc.js:29-29"

# ── 입출력 ──
inputs:
  - "msg"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "_secureDocBannerShow"
  - "setUiBusySuffix"
calls_external:
  - "test"
called_by:
  - "downloadAllFilesZip"
  - "registerWorkbookBackend"
  - "secureDocMaybeEncryptBlob"
  - "secureDownloadUrl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
업로드 중 다운로드같이 겹쳐도 먼저 끝난 쪽이 배너를 꺼버리지 않게 카운터로 센다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `_secureDocBannerShow`, `setUiBusySuffix`
- 피호출(영향 전파 경로): `downloadAllFilesZip`, `registerWorkbookBackend`, `secureDocMaybeEncryptBlob`, `secureDownloadUrl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

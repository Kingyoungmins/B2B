---
type: endpoint
title: AttachDownloadCompletionToast
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "(CoreWebView2DownloadOperation operation, string path)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "NativeHost.cs:739-739"

# ── 입출력 ──
inputs:
  - "CoreWebView2DownloadOperation operation"
  - "string path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "WebView2 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "Log"
  - "NotifyWebToast"
calls_external:
  - "GetFileName"
  - "IsNullOrWhiteSpace"
  - "ToString"
called_by:
  - "HandleDownloadStarting"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- WebView2 조작

## 관계
- 호출: `Log`, `NotifyWebToast`
- 피호출(영향 전파 경로): `HandleDownloadStarting`

## 실패/예외
- `(명시적 raise 없음/미탐지)`

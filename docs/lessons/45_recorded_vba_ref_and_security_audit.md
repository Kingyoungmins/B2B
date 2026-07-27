# 45. 녹화 VBA 참조·보안 전면 감사 — 리터럴은 인프라를 못 움직이지만, VBA 자신은 뭐든 한다

**버전**: 0.7.0 (2026-07-27) · **트리거**: 교차파일 12단계 녹화 스킬의 subscript 오류 + "실행기가 임의 파일을 찾지 않나" 우려

## 감사 결론 (4갈래 조사 + 실물 검증)

### 안전했던 것 — 인프라는 녹화 리터럴로 파일을 열지 않는다
- `_normalize_vba_workbook_literals`/`_alias_open_workbook_name`: 리터럴을 **이미 열린 워크북에만** 매칭. 미매칭 → 그대로 남아 VBA error 9. `Workbooks.Open` 전달·디스크 검색 없음.
- 컴패니언 열기(isolated/fullrun)는 전부 `EXCEL_SESSIONS` → `SaveCopyAs` 임시사본. `recordedWorkbookFullName`도 세션 문자열 비교에만 사용.

### 뚫려 있던 것 — 녹화 VBA 본문은 무검사로 재생됐다
1. **서버 VBA 보안 게이트 부재**: 녹화 중 파일 열기(`Workbooks.Open "C:\녹화PC경로\..."`), `SaveAs`, `.Close`, `Shell`, `Kill` 등이 sanitize(스크롤 제거뿐)·클라 검증(LLM 출력에만 적용, 실패 시 원본 폴백)·서버 문법 게이트를 전부 통과. 심지어 실행 직전 `AutomationSecurity=Low`. python 엔진(AST 금지목록)과 비대칭.
   → **수정**: `_vba_security_scan`을 `_validate_vba_source_before_inject` 최상단에(단일 관문). 문자열·주석 제거 후 검사(셀값 "Shell 주유소" 오탐 방지), `Scripting.Dictionary` 허용, `.Save` 허용(Ctrl+S 습관). `_recorded_vba_hazards`에 차단 예고 ⚠ 추가.
2. **교차파일 쓰기 추론 VBA-blind**: `crossWriteDestinationFileIds`가 python `dst_book`/`ctx.book`만 파싱 → 녹화 스텝의 `Windows("X").Activate` 쓰기가 리셋 집합·체크포인트/빠른수정 가드·삭제 추가리셋에서 전부 누락(되돌리기가 목적지를 안 되돌림 = 조용한 데이터 어긋남, 재실행 중복).
   → **수정**: `(?:Windows|Workbooks)("X.xls*").Activate` 파싱 추가(과잉 포함은 안전 방향).
3. **분할 조각 균일 도장**: LLM 분할 조각 전부에 녹화 시작 파일의 `targetFileId`/`recordedSheet`가 찍히고 `recordedWorkbook`은 유실 → 타 파일 조각의 스냅샷/사전활성/실행기 요구가 첫 파일로 쏠림.
   → **수정**: makeStep이 조각의 첫 `Activate` 워크북을 실질 대상으로(`_chunkPrimaryBook`), 비앵커 조각엔 앵커 시트명 오도장 금지(`_isAnchorChunk`), `recordedWorkbook` 조각별 durable 도장.
4. **실행기 (파일,시트) 쌍 추출 누락**: 쌍 추출기가 `Workbooks("X").Worksheets("Y")`만 인식 — MS 레코더 관용구(`Windows("X").Activate` + 비한정 `Sheets("Y").Select`)는 불가시 → 두 번째 파일부터 시트 요구·리터럴 재작성 누락.
   → **수정**: `runnerRecordedActivatePairs` 신설, 요구추출(`vba-recorded-pair`)·소유쌍 양쪽 배선.

## 남은 한계(의도적 미수정)
- **시트명 월 재바인딩 없음**: 파일명은 stable-key(월/날짜 무시)로 매칭되지만 시트명("202604"→"202605")은 exact/normalize만. 단일명확매칭 철학(다른달 재바인딩 교훈)과 충돌해 보류 — 녹화 시트 Select는 세정기가 대부분 제거하므로 실노출 작음.
- `Workbooks.Add`(새 통합문서)는 차단 대신 hazard 경고만(결과 미수집 안내).

## 재발 방지
- `diagnostics/_test_vba_security_scan.py` (16케이스) · `diagnostics/_test_recorded_ref_guards.js` (13케이스)
- registry: `RECORD-VBA-SECURITY-GATE`, `RECORD-CROSSFILE-REF-GUARDS` (+ 같은 날 `RECORD-CAPTURE-DUP`, `RECORD-SPLIT-STALE-SELECT`)

## 교훈
- "인프라가 안 연다"와 "VBA가 못 연다"는 다른 명제 — 주입 코드는 Excel 전권을 가지므로 **주입 전 단일 관문 검사**가 유일한 방어선.
- 참조 추론(교차 쓰기/요구 쌍)에 새 코드 방언(녹화 VBA)이 들어오면 **모든 추출기를 방언 목록으로 감사**할 것: dst_book만 보던 함수 5곳이 전부 사각지대였다.

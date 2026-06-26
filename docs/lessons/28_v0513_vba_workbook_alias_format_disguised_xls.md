# 28. 포맷 위장 .xls(HTML/CSV)에서 VBA가 워크북을 못 찾던 버그 — 등록명↔실제명 별칭 (SBAGENT-138, v0.5.13)

## 증상
`@범위[500255...-20260531.xls/excel_open_ea2d2cfe22a74a92aaea!A:D]` 처럼 **정확히 지정**하고
VBA(`Workbooks("500255...xls").Worksheets("excel_open_ea..")`)를 적용해도
"아래첨자 사용이 잘못(subscript out of range)" = 파일을 못 찾음. 반복.
사용자 확인: 직접 열면 제목표시줄에 `500255...xls`로 뜨고 **"신뢰할 수 있냐"(포맷/확장자 불일치 경고)** 가 뜸,
프로그램으로 열면 **`excel_open_<uuid>.html`** 로 뜸. → 시트명(`excel_open_ea..`)은 원본 그대로.

## 근본 원인
이 파일은 **HTML(또는 CSV)을 `.xls`로 위장**한 빌링 export. `excel_compatible_open_path`(serve_b2b.py)가
`sniff_text_excel_suffix` 로 텍스트(HTML)임을 감지 → `BACKEND_DIR/excel_open_<uuid>.html` 로 복사해서 연다
(직접 열 때의 경고를 피하고 안정적으로 열기 위함). 그 결과:
- 실제 열린 워크북 `wb.Name = excel_open_<uuid>.html`.
- 멘션/등록명은 원본 `500255...xls` 그대로(시트명은 실제 워크북에서 추출돼 원본명과 일치).
- 모델 VBA는 멘션 기준 `Workbooks("500255...xls")` 생성 → 실제명과 **공유 부분 없이** 어긋남 → 실패.

이미 있던 `_normalize_vba_workbook_literals`/`_resolve_open_workbook_name`은 URL/공백 차이만 흡수할 뿐,
**변환 리네임(등록명↔excel_open_<uuid>)을 이어줄 매핑이 어디에도 저장되지 않아** 풀지 못했다.

## 수정 (결정적 백엔드 별칭 — 모델 의존 0)
- `excel_workbooks_open(app, path, ..., intended_name=None)`: 열린 실제 `wb.Name` 이 의도한 이름(`intended_name`
  또는 `path` 의 파일명=등록명)과 다르면(=변환됨) **앱(pid)별로 등록명→실제명 별칭 저장**(`_stash_workbook_name_alias`).
  이름이 같으면(일반 .xlsx) 저장 안 함 → 회귀 0.
- `_alias_open_workbook_name(app, name)`: 기존 정확/정규화 매칭 먼저, 실패 시 별칭(1:1 + **실제 열림 검증**)으로 실제명 반환.
- `_normalize_vba_workbook_literals` 의 리터럴 치환을 `_alias_open_workbook_name` 으로 교체 → 주입 직전
  `Workbooks("500255...xls")` 가 `Workbooks("excel_open_<uuid>.html")` 로 자동 정정. **시트명은 안 건드림**(이미 실제명).
- 호출부는 등록명 사본 경로(`tpath`/`cpath`/working_copy)라 별도 인자 없이 등록명으로 저장됨(라이브/격리/companion 공통).

## 수정 2 — 시트명 안정화 (워크북 별칭만으론 부족했음)
직접 COM 테스트로 추가 확인: 텍스트(HTML/CSV) 변환 파일은 Excel 이 **시트를 '임시 파일명 stem(31자 truncate)'으로
자동명명**한다. `excel_compatible_open_path` 가 매 open 마다 `excel_open_<random uuid>` 를 만들어, **워크북명뿐 아니라
시트명도 매 open 마다 바뀐다**(open#1 시트 `excel_open_<rand1 앞20>`, open#2 `excel_open_<rand2 앞20>`). @멘션은
세션오픈 시점의 시트명을 캡처하는데 VBA 실행은 다른 open(다른 uuid)이라 시트명이 어긋나 `Worksheets(...)` 가 실패했다
(워크북은 별칭으로 잡혀도 시트에서 막힘).
→ 변환 임시파일명 앞 31자(`"excel_open_"`(11) + 해시 20자 = 시트명 truncate 경계)를 **'원본 파일명' md5 해시로 고정**.
뒤에 random uuid 를 붙여 파일 경로는 유일(동시 오픈 file-lock 회피)하되, **시트명(31자 truncate)은 매 open 동일**해진다.
워크북명(전체)은 random 으로 매번 달라도 _alias_open_workbook_name 이 등록명으로 해석한다.
즉 두 수정(워크북 별칭 + 시트명 안정화)이 함께 있어야 `.xls=HTML` 파일에서 정확 지정이 동작한다.

## 검증
- `test_runs/_test_vba_workbook_alias_format_convert.py`(신규, mock app 단위): 변환 별칭 저장 → `Workbooks("등록명.xls")`
  → 실제명(.html) 치환, 시트명 보존, 일반 .xlsx 미치환(회귀 0), 스테일/미오픈 별칭 미치환(안전), URL(%20) 정규화 유지. 7/7 PASS.
- `test_runs/_test_html_xls_stable_sheetname.py`(신규, COM E2E): HTML-as-.xls 를 두 번(다른 인스턴스) 열어 **시트명이 동일**한지 확인. PASS.
- py_compile / 격리 회귀 OK. 소비 경로 연결 확인(_inject_and_run_vba → _normalize_vba_workbook_literals @6078).

## 교훈
- 포맷 위장 파일(.xls=HTML/CSV)은 흔하다(빌링 export). 앱이 안정적 오픈을 위해 변환하면 **워크북 이름이 바뀐다**.
  멘션/생성코드는 등록명을 쓰므로 **등록명↔실제명 별칭**을 열 때 저장해 VBA 참조를 자동 정정해야 한다.
- 시트명은 실제 워크북에서 추출돼 이미 실제명이므로 **건드리면 안 됨**(워크북명만 정정).
- 별칭은 1:1 + 실제 열림 검증으로 모호/스테일 오치환을 차단(pid 재사용 시에도 안전).

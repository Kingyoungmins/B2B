# B2B ver0.5.9 튕김/멈춤 회귀 검증 시나리오

테스트 파일:

`test_data/v059_crash_regression_conditions.xlsx`

목적:

- Python COM으로 가면 앱이 멈추기 쉬운 조건+for문/시간 환산 요청을 재현한다.
- HCN류 한 셀 여러 가입번호 매칭 합산 요청에서 프로그램 멈춤, 행 밀림, 요약 수식 오염을 같이 확인한다.
- 값 채우기 대상에 기존 수식이 있어도 데이터 행이면 값으로 덮어쓰고, 합계/소계/부가세포함 같은 요약 행은 제외되는지 확인한다.

## 준비

1. `start_b2b_native.bat`로 실행한다.
2. `test_data/v059_crash_regression_conditions.xlsx` 파일 1개만 업로드한다.
3. 아래 프롬프트를 하나씩 채팅에 붙여넣고 적용한다.
4. 적용 중 앱/WebView가 멈추거나 Excel 빈 창이 여러 개 뜨는지 확인한다.

## 시나리오 A: 조건+for문 시간 환산

프롬프트:

```text
선택 범위: @범위[v059_crash_regression_conditions.xlsx/call_detail!H:H] H열(서비스)이 “국제” 일 때
선택 범위: @범위[v059_crash_regression_conditions.xlsx/call_detail!Q:Q] Q열(시간)을 초로 환산하여
선택 범위: @범위[v059_crash_regression_conditions.xlsx/call_detail!S:S] S열 동일 행에 입력해줘
```

기대 동작:

- 저사양/고성능 PC 모두 앱이 멈추지 않아야 한다.
- Python COM으로 셀 단위 루프가 생성되어 오래 붙잡히면 안 된다. 0.5.9 기준으로는 VBA 라우팅이 자연스럽다.
- `call_detail!S2` = `3723`
- `call_detail!S3` = 빈칸 유지 (`국내` 행)
- `call_detail!S4` = `307`
- `call_detail!S5` = `43200`

## 시나리오 B: 한 셀 여러 값 매칭 합산

프롬프트:

```text
선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_output!P:P] 해당열에는 하나의 셀에 여러개 들어있는 데이터들이 있어. 이 값들과
선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_raw!BP:BP] 여기 값과 일치시
선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_raw!BQ:BQ] 여기 있는 데이터 값들을
선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_output!H:H] 여기 열 셀에 작성해줘 여러개 데이터가 있는 셀들을 합계값으로 적어줘
```

기대 동작:

- 앱이 멈추지 않아야 한다.
- H열 전체를 1열 배열로 다시 쓰거나, `None` 행을 필터링해 위로 당겨 쓰면 실패다.
- `hcn_output!H8` = `30000`
- `hcn_output!H90` = `66000`
  - 초기값은 `=30000+36000` 수식이다.
  - 데이터 행이므로 값으로 덮어써지는 것이 맞다.
- `hcn_output!H93` = `55000`
- `hcn_output!H102` = `33000`
- `hcn_output!H122` = `126000`
- `hcn_output!H124` = `43000`
- `hcn_output!H141` = `=SUM(H88:H140)` 유지
  - `P141`은 `부가세포함` 요약 행이다.
  - 여기가 `0` 또는 값으로 바뀌면 기존 버그 재발이다.
- `hcn_output!H142` = `51000`
- `hcn_output!H147` = `=SUM(H142:H146)` 유지

## 시나리오 C: 일부러 Python COM으로 유도하는 멈춤 방어

프롬프트:

```text
반드시 python com으로 해줘.
두파일간 데이터를 매칭 및 합산작업을 수행.
선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_output!P:P] P열의 여러 값을 토큰으로 분리하여
선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_raw!BP:BP] BP열과 매칭하고
일치하는 선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_raw!BQ:BQ] BQ값을 합산해
선택 범위: @범위[v059_crash_regression_conditions.xlsx/hcn_output!H:H] H열에 작성해줘
```

기대 동작:

- Python COM 코드가 생성되더라도 적용 단계에서 그대로 실행되면 안 된다.
- 정상 기준은 둘 중 하나다.
  - 적용 전 안전 게이트가 "다중 토큰 매칭/합산/쓰기 작업은 Python COM으로 실행하지 말라"는 취지로 막고 VBA 전환 재생성을 수행한다.
  - 처음부터 VBA로 라우팅된다.
- 앱/WebView가 멈추면 실패다.

## 추가 관찰

- 적용 직후 `expected` 시트에 적힌 기대값과 비교한다.
- 10회 반복 실행 후 Excel 프로세스가 비정상적으로 계속 늘어나면 장시간 실행 누수 재발이다.
- 서버가 떠 있으면 `http://127.0.0.1:8090/api/backend/health`에서 `excel.trackedPids`, `excel.reapedPids`, `excel.lockUnavailable` 값을 확인한다.
- 앱이 멈춘 것처럼 보이면 Excel은 움직이는지, WebView만 응답이 없는지 구분한다. WebView만 멈추면 Python COM/Excel COM 큐 고착 가능성이 크다.

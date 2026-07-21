# test_mapping

B2B 0.5.19 실행기 파일/시트 매핑 기능 테스트용 자료입니다.

## 파일 구성
- `actual_sales_2026_06.xlsx`: 실제 입력 파일 1. 시트명은 `ActualSales`
- `actual_adjustments_2026_06.xlsx`: 실제 입력 파일 2. 시트명은 `ActualAdjust`
- `actual_codes_2026_06.xlsx`: 실제 입력 파일 3. 시트명은 `ActualCodes`
- `actual_output_template_2026_06.xlsx`: 실제 출력 템플릿. 시트명은 `ActualResult`
- `mapping_test_saved_skill.zip`: 저장된 스킬 zip. 앱에서 읽을 수 있도록 무압축 ZIP 형식으로 생성됨

## 저장된 스킬이 찾는 예전 이름
스킬은 일부러 아래 파일명/시트명을 찾도록 만들어져 있습니다.

- `expected_sales.xlsx` / `SalesData`
- `expected_adjustments.xlsx` / `AdjustData`
- `expected_codes.xlsx` / `CodeMap`
- `expected_output.xlsx` / `ResultSheet`

## 테스트 순서
1. 실행기에서 실제 입력 파일 3개를 업로드합니다.
2. `actual_output_template_2026_06.xlsx`를 출력 템플릿으로 업로드합니다.
3. `mapping_test_saved_skill.zip`을 스킬로 불러옵니다.
4. 가운데 `파일확인` 버튼을 누릅니다.
5. 우측 매핑 패널에서 아래처럼 연결합니다.

| 스킬이 찾는 대상 | 실제 사용할 대상 |
| --- | --- |
| `expected_sales.xlsx` / `SalesData` | `actual_sales_2026_06.xlsx` / `ActualSales` |
| `expected_adjustments.xlsx` / `AdjustData` | `actual_adjustments_2026_06.xlsx` / `ActualAdjust` |
| `expected_codes.xlsx` / `CodeMap` | `actual_codes_2026_06.xlsx` / `ActualCodes` |
| `expected_output.xlsx` / `ResultSheet` | `actual_output_template_2026_06.xlsx` / `ActualResult` |

6. 가운데 버튼이 `실행하기`로 바뀌면 실행합니다.

## 기대 결과
- `ActualResult` 시트 2~5행에 매출, 조정금액, 최종금액, 분류가 채워집니다.
- 스킬 실행 중 `Validation_Result` 시트가 새로 생성됩니다.
- `Validation_Result`는 스킬 중간에 만들어지는 시트이므로 파일/시트 매핑 대상 목록에 뜨면 안 됩니다.

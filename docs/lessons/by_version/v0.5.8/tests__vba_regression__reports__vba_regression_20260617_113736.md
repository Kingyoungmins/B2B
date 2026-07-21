# VBA Regression Report

- Mode: `vba`
- Generator (Qwen) model: `Qwen/Qwen3.6-27B-FP8`
- Base URL: `http://192.168.219.111:8000/v1`
- Summary: `FAIL` {'WARN': 8, 'NEEDS_WINDOWS': 40, 'FAIL': 1, 'PASS': 8}
- Reviewer (Sonnet) model: `claude-sonnet-4-6`
- Sonnet verdicts: {'RISK': 25, 'PASS': 31, 'FAIL': 1}

## Sonnet 종합 평가 — RISK

_Sonnet 종합 평가 생성 실패: Sonnet 응답이 max_tokens(3000)에서 잘려 JSON 이 불완전합니다. max_tokens 를 늘리세요. (원오류: Unterminated string starting at: line 1 column 30 (char 29))_

## column_move_values_null / reorder_billing_columns — WARN

Prompt:
```text
매출 시트에서 금액(D)열을 건수(C)열 앞으로 옮겨줘. 헤더만 옮겨지고 값이 null로 비지 않게, 값까지 같이 이동해야 해.
```
Warnings:
- Deletes whole rows/columns; verify target scope in Windows E2E.
- No value/format-preserving copy detected; result may land as null/empty.
- Sonnet 검수 RISK: 코드의 기본 동작(D열을 C열 앞으로 이동)은 사용자 의도와 일치하고, 1200행 헤더+값이 함께 이동되므로 expected와 부합합니다. 다만 Copy+Insert+Delete 방식은 Cut+Insert 대비 불필요한 단계가 있어 오류 시 잔본 데이터가 남을 위험이 있고, 서식·유효성 검사 등 메타데이터 보존이 완전하지 않을 수 있습니다. 핵심 기능은 동작하나 더 안전한 구현이 가능하므로 RISK로 판정합니다.
Needs Windows:
- Verify pasted cells carry actual values (not null) in real Excel.
- 이동된 열이 헤더와 실제 값을 함께 담고 null 이 아닌지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 아니오
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!C1` → 금액(이동 후 헤더)
  - `매출!C2` → 1435000(이동 후 값)
  - `매출!D1` → 건수(밀려난 헤더)
  - `매출!D2` → 41(밀려난 값)
  - `매출!E1` → (삭제됨 - 원래 D열의 복사본이 삭제)
- 근거: 코드의 기본 동작(D열을 C열 앞으로 이동)은 사용자 의도와 일치하고, 1200행 헤더+값이 함께 이동되므로 expected와 부합합니다. 다만 Copy+Insert+Delete 방식은 Cut+Insert 대비 불필요한 단계가 있어 오류 시 잔본 데이터가 남을 위험이 있고, 서식·유효성 검사 등 메타데이터 보존이 완전하지 않을 수 있습니다. 핵심 기능은 동작하나 더 안전한 구현이 가능하므로 RISK로 판정합니다.
- 위험: Copy+Insert 방식은 원본 D열이 E열에 남아있다가 명시 삭제되는 2단계 구조라, 두 단계 사이에 오류 발생 시 D열 데이터가 E열에 잔존할 수 있음
- 위험: Copy 시 셀 서식(배경색, 테두리, 조건부 서식, 유효성 검사 등)이 완전히 복사되지 않을 가능성 존재
- 위험: 1200행 전체를 Copy+Insert+Delete하는 3단계 연산은 Cut+Insert 단일 연산보다 COM 경유 시 처리 시간이 길고 클립보드 충돌 위험이 있음
- 위험: Cleanup 레이블 방식에서 On Error GoTo Cleanup 이후 Columns(E).Delete 에서 오류가 나면 E열이 삭제 안 된 채 복사 잔본이 남음
- 수정 필요: Copy+Insert+Delete 3단계 방식을 Cut+Insert 단일 단계로 교체하여 원자성·서식 보존 보장

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_현재 코드는 Copy+Insert 후 원본 E열 삭제 방식인데, Cut+Insert 한 번으로 완전히 동일한 결과를 더 안전하게 달성할 수 있습니다. Copy 방식은 클립보드에 복사본을 올린 뒤 Insert하므로 서식·셀 주석·유효성 검사 등이 완전히 보존되지 않을 수 있고, 클립보드 상태 관리가 복잡합니다. Cut+Insert는 Excel 내부적으로 단일 이동 동작으로 처리되어 서식·유효성·주석까지 온전히 이동되며, 별도 삭제 단계가 필요 없어 코드도 단순해집니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")

    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")

    ' D열 전체를 Cut하여 C열 앞에 Insert: 헤더+값+서식 모두 보존
    ws.Columns("D").Cut
    ws.Columns("C").Insert Shift:=xlToRight
    Application.CutCopyMode = False

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")
    
    ' D열(금액)을 C열(건수) 앞으로 이동
    ' 1. D열을 C열 앞에 복사하여 삽입 (C열은 오른쪽으로 밀려 D열이 됨, 기존 D열은 E열이 됨)
    ws.Columns("D").Copy
    ws.Columns("C").Insert Shift:=xlToRight
    Application.CutCopyMode = False
    
    ' 2. 기존 D열(이제 E열에 있음) 삭제
    ws.Columns("E").Delete Shift:=xlToLeft

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: WARN

## column_move_values_null / move_named_columns — WARN

Prompt:
```text
원가 시트의 '단가'와 '원가' 열 순서를 서로 바꿔줘. 값이 빠지지 않고 헤더와 데이터가 같이 이동해야 해.
```
Warnings:
- No value/format-preserving copy detected; result may land as null/empty.
- Sonnet 검수 RISK: 코드는 사용자 요청대로 '원가' 시트에서 '단가'와 '원가' 헤더를 동적으로 찾아 해당 열 전체(헤더+데이터)를 배열로 읽어 교환합니다. 스키마상 해당 열에는 수식이 없는 순수 숫자값이므로 .Value 배열 교환이 안전하게 동작합니다. COM 런타임 오류 가능성도 낮고 의도와 범위가 정확히 일치하나, A열 기반 lastRow 산출 방식과 수식 포함 시 수식 소멸 가능성이 잠재적 위험으로 남아 RISK로 판정합니다.
Needs Windows:
- Verify pasted cells carry actual values (not null) in real Excel.
- 이동된 열이 헤더와 실제 값을 함께 담고 null 이 아닌지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `원가!C1` → 원가
  - `원가!D1` → 단가
  - `원가!C2` → 59383
  - `원가!D2` → 90000
  - `원가!C3` → 25335
  - `원가!D3` → 35000
- 근거: 코드는 사용자 요청대로 '원가' 시트에서 '단가'와 '원가' 헤더를 동적으로 찾아 해당 열 전체(헤더+데이터)를 배열로 읽어 교환합니다. 스키마상 해당 열에는 수식이 없는 순수 숫자값이므로 .Value 배열 교환이 안전하게 동작합니다. COM 런타임 오류 가능성도 낮고 의도와 범위가 정확히 일치하나, A열 기반 lastRow 산출 방식과 수식 포함 시 수식 소멸 가능성이 잠재적 위험으로 남아 RISK로 판정합니다.
- 위험: 원가 시트의 단가/원가 열에 수식이 존재할 경우 .Value2 읽기 시 수식이 계산된 값으로 읽혀 쓰기 후 수식이 사라질 수 있음(스키마 확인 결과 현재는 순수 값이므로 실질 위험 낮음)
- 위험: lastRow 산출을 1열(A열) 기준 End(xlUp)으로 하므로 A열이 비어 있는 행이 있으면 실제 데이터보다 짧은 범위를 대상으로 교환할 수 있음
- 위험: COM 환경에서 .Value 배열 할당 시 1-based 2D 배열로 반환되나, 단일 열의 경우 (N,1) 형태로 정상 동작하므로 대입 문제는 없음

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드와 로직은 동일하나 .Value 대신 .Value2를 사용해 날짜/통화 등 COM 직렬화 오류를 방지하고, 변수명 중복(wsFound→ws 직접 사용)을 정리해 가독성을 높였습니다. 스키마 상 '원가' 시트의 해당 열에는 수식이 없는 순수 값 열이므로 배열 교환 방식은 안전하지만, 만약 수식이 포함될 경우 수식이 값으로 대체될 수 있다는 주의가 필요합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim wbName As String: wbName = "input_원가_2026_4월.xlsx"

    Dim wbFound As Workbook
    For Each wbFound In Application.Workbooks
        If wbFound.Name = wbName Then
            Set wb = wbFound
            Exit For
        End If
    Next wbFound
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'" & wbName & "' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Dim sh As Worksheet
    For Each sh In wb.Worksheets
        If sh.Name = "원가" Then
            Set ws = sh
            Exit For
        End If
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 시트를 찾지 못했습니다."

    Dim hdrRow As Long: hdrRow = 1
    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column

    If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."

    Dim colDan As Long, colWon As Long
    colDan = 0: colWon = 0
    Dim c As Long
    For c = 1 To lastCol
        Dim val As String
        val = Trim(CStr(ws.Cells(hdrRow, c).Value))
        If val = "단가" Then colDan = c
        If val = "원가" Then colWon = c
    Next c

    If colDan = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'단가' 헤더를 찾지 못했습니다."
    If colWon = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 헤더를 찾지 못했습니다."

    ' 임시 열을 사용해 3-step 이동 (배열 교환 방식 대신 실제 열 잘라붙이기)
    Dim tmpCol As Long
    tmpCol = lastCol + 2  ' 기존 데이터와 겹치지 않는 빈 열

    ' 단가 열 -> 임시 열 복사
    Dim rngDan As Range, rngWon As Range, rngTmp As Range
    Set rngDan = ws.Range(ws.Cells(hdrRow, colDan), ws.Cells(lastRow, colDan))
    Set rngWon = ws.Range(ws.Cells(hdrRow, colWon), ws.Cells(lastRow, colWon))
    Set rngTmp = ws.Range(ws.Cells(hdrRow, tmpCol), ws.Cells(lastRow, tmpCol))

    ' 배열 방식: 수식 없는 값/텍스트 열이므로 .Value 교환 안전
    ' 단, 혹시 수식이 있을 경우를 대비해 명시적으로 .Value2 사용
    Dim arrDan As Variant, arrWon As Variant
    arrDan = rngDan.Value2
    arrWon = rngWon.Value2

    ' 교환
    rngDan.Value2 = arrWon
    rngWon.Value2 = arrDan

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim ws As Worksheet
    Dim wbName As String: wbName = "input_원가_2026_4월.xlsx"
    
    ' 워크북 찾기
    Dim wbFound As Workbook
    For Each wbFound In Application.Workbooks
        If wbFound.Name = wbName Then
            Set wb = wbFound
            Exit For
        End If
    Next wbFound
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'" & wbName & "' 가 열려 있지 않습니다."

    ' 시트 찾기
    Dim wsFound As Worksheet
    Dim sh As Worksheet
    For Each sh In wb.Worksheets
        If sh.Name = "원가" Then
            Set wsFound = sh
            Exit For
        End If
    Next sh
    If wsFound Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 시트를 찾지 못했습니다."
    Set ws = wsFound

    Dim hdrRow As Long: hdrRow = 1
    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    
    If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."

    ' 헤더에서 '단가'와 '원가' 열 찾기
    Dim colDan As Long, colWon As Long
    colDan = 0: colWon = 0
    Dim c As Long
    For c = 1 To lastCol
        Dim val As String
        val = Trim(CStr(ws.Cells(hdrRow, c).Value))
        If val = "단가" Then colDan = c
        If val = "원가" Then colWon = c
    Next c
    
    If colDan = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'단가' 헤더를 찾지 못했습니다."
    If colWon = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 헤더를 찾지 못했습니다."

    ' 해당 열의 데이터(헤더 포함)를 배열로 읽기
    Dim arrDan As Variant, arrWon As Variant
    Dim rngDan As Range, rngWon As Range
    
    Set rngDan = ws.Range(ws.Cells(hdrRow, colDan), ws.Cells(lastRow, colDan))
    Set rngWon = ws.Range(ws.Cells(hdrRow, colWon), ws.Cells(lastRow, colWon))
    
    arrDan = rngDan.Value
    arrWon = rngWon.Value
    
    ' 배열 값 교환 후 다시 쓰기
    rngDan.Value = arrWon
    rngWon.Value = arrDan

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: WARN

## column_move_values_null / rearrange_keep_data — WARN

Prompt:
```text
회사별요약에서 원가(C)열을 매출(B)열 앞으로 재배치해줘. 마진/마진율 수식이 깨지지 않고, 값도 null 없이 따라와야 해.
```
Warnings:
- No value/format-preserving copy detected; result may land as null/empty.
Needs Windows:
- Verify pasted cells carry actual values (not null) in real Excel.
- 이동된 열이 헤더와 실제 값을 함께 담고 null 이 아닌지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!B3` → 원가 (헤더, 이동 후)
  - `회사별요약!C3` → 매출 (헤더, 이동 후)
  - `회사별요약!B4` → (원가 값, 이동됨)
  - `회사별요약!C4` → (매출 값, 이동됨)
  - `회사별요약!D4` → =C4-B4 (Excel이 열 이동 후 참조 자동 조정 → 원래 매출-원가 논리 유지)
  - `회사별요약!E4` → =IFERROR(D4/C4,0) (Excel이 열 이동 후 참조 자동 조정 → 마진/매출 논리 유지)
  - `회사별요약!D24` → =SUM(D4:D23) (참조 열 변경 없음, 그대로 유지)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (참조 열 변경 없음, 그대로 유지)
- 근거: ws.Columns("C").Cut 후 ws.Columns("B").Insert Shift:=xlToRight 는 Excel COM에서 C열 전체를 잘라 B열 앞에 삽입하는 표준 패턴으로, 헤더·값·서식이 함께 이동하고 D/E열의 수식 참조도 자동으로 재조정된다. 사용자가 요청한 '원가를 매출 앞으로, 마진/마진율 수식 보존, 값 null 없음' 세 가지 조건을 모두 충족한다. 워크북·시트 탐색 시 Err.Raise로 오류를 드러내며 On Error Resume Next를 사용하지 않아 COM 런타임 오류 감지도 적절하다.
- 위험: Cut/Insert 방식은 Excel이 내부적으로 수식 참조를 자동 재조정하므로 D열(마진)과 E열(마진율) 수식이 의도한 대로 업데이트되지만, COM 환경에서 Cut 후 Insert 사이에 클립보드 상태가 초기화될 경우 1004 오류가 드물게 발생할 수 있음
- 위험: 병합셀(A1:E1)이 존재하므로 열 삽입 시 병합 범위가 A1:F1로 자동 확장될 수 있음 — 실제로는 문제 없으나 예상치 못한 병합 범위 변화가 발생할 수 있음
- 위험: 저사양 PC에서 ScreenUpdating=False + Calculation=Manual 상태에서 Cut/Insert 연산은 대체로 안전하나, 재계산 복원 후 D/E열 수식이 일시적으로 0으로 보일 수 있음(저장 전 강제 재계산 권장)

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim ws As Worksheet
    
    ' 대상 워크북 및 시트 찾기
    Dim wbFound As Boolean: wbFound = False
    Dim wbLoop As Workbook
    For Each wbLoop In Application.Workbooks
        If wbLoop.Name = "output_청구서_템플릿.xlsx" Then
            Set wb = wbLoop
            wbFound = True
            Exit For
        End If
    Next wbLoop
    If Not wbFound Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    
    Dim wsFound As Boolean: wsFound = False
    Dim shLoop As Worksheet
    For Each shLoop In wb.Worksheets
        If shLoop.Name = "회사별요약" Then
            Set ws = shLoop
            wsFound = True
            Exit For
        End If
    Next shLoop
    If Not wsFound Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."

    ' B열(매출)과 C열(원가) 교환
    ' 1. C열(원가)을 B열(매출) 앞으로 이동 (C열이 B열 위치로, 기존 B열이 D열 위치로 밀림)
    '    하지만 단순히 C를 B 앞으로 넣으면 순서가 [원가, 매출, (구)원가위치이제D] 가 됨.
    '    우리가 원하는 최종 순서: [매출(B), 원가(C)] -> [원가(B), 매출(C)]
    '    
    '    전략:
    '    1. C열(원가)을 잘라내어 B열(매출) 앞에 붙여넣기.
    '       현재: A, B(매출), C(원가), D(마진), E(마진율)
    '       C를 A 뒤에 붙이면: A, C(원가), B(매출), D(마진), E(마진율)
    '       이때 D, E의 수식은 자동으로 B, C 열 참조로 업데이트됨.
    '       D(마진)은 원래 B-C 였다면, 이제 B는 원가, C는 매출이 되었으므로 D는 C-B 로 업데이트되어야 함.
    '       Excel의 열 이동 시 수식 참조는 자동으로 조정됩니다.
    '       원래 D4 = B4 - C4 (매출 - 원가)
    '       C열이 B열 앞으로 가면, 기존 B열은 C열로, 기존 C열은 B열로 위치 변경.
    '       수식 D4는 자동으로 C4 - B4 로 변경될 것입니다. (매출 - 원가 로 유지됨)
    '       E4 = D4 / B4 (마진 / 매출) -> E4 = D4 / C4 로 변경될 것입니다. (마진 / 매출 로 유지됨)
    '
    '    실행:
    '    ws.Columns("C").Cut
    '    ws.Columns("B").Insert Shift:=xlToRight
    
    '    확인:
    '    기존 B열(매출)이 C열로 이동, 기존 C열(원가)이 B열로 이동.
    '    수식 참조 자동 업데이트로 논리 유지.

    ws.Columns("C").Cut
    ws.Columns("B").Insert Shift:=xlToRight

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: WARN

## datetime_format_preserve / copy_time_values — NEEDS_WINDOWS

Prompt:
```text
고객정보 시트에서 날짜 형태 데이터를 다른 열로 옮길 때 'false'로 바뀌지 않게 값을 그대로 옮겨줘.
```
Warnings:
- Sonnet 검수 RISK: 원본 코드는 고객정보 시트의 실제 열 구성(회사명/사업자번호/담당자/연락처)을 기준으로 보면 날짜 NumberFormat을 가진 열이 존재하지 않아 dateColCount=0이 되고, 결과적으로 Err.Raise로 종료되어 아무 작업도 수행되지 않습니다. 사용자가 원하는 '날짜 형태 데이터를 false 없이 이동'이라는 의도와 완전히 불일치하므로 RISK로 판정합니다. NumberFormat 검사 외 IsDate() 및 텍스트 날짜 패턴 탐지를 추가해야 실제 날짜 열을 올바르게 찾을 수 있습니다.
Needs Windows:
- Verify date/time cells keep their value+number format (not 'false') in Excel.
- Verify pasted cells carry actual values (not null) in real Excel.
- 날짜/시간 셀이 'false'/True 가 아니라 원래 값+표시형식을 유지하는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: \bCBool\b
- Forbidden pattern absent: \.Value2?\s*=\s*(?:True|False)\b
- No boolean cast on date/time data.
- Copies source .Value into destination .Value (value carried).
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 아니오 · 수식 보존: 아니오
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `고객정보!E1(새 열)` → (Err.Raise: 날짜 형식인 열을 찾지 못했습니다. — 작업 중단)
  - `고객정보!A2` → (변경 없음)
  - `고객정보!B2` → (변경 없음)
  - `고객정보!C2` → (변경 없음)
  - `고객정보!D2` → (변경 없음)
- 근거: 원본 코드는 고객정보 시트의 실제 열 구성(회사명/사업자번호/담당자/연락처)을 기준으로 보면 날짜 NumberFormat을 가진 열이 존재하지 않아 dateColCount=0이 되고, 결과적으로 Err.Raise로 종료되어 아무 작업도 수행되지 않습니다. 사용자가 원하는 '날짜 형태 데이터를 false 없이 이동'이라는 의도와 완전히 불일치하므로 RISK로 판정합니다. NumberFormat 검사 외 IsDate() 및 텍스트 날짜 패턴 탐지를 추가해야 실제 날짜 열을 올바르게 찾을 수 있습니다.
- 위험: 고객정보 시트의 실제 헤더가 ['회사명','사업자번호','담당자','연락처']로 날짜 NumberFormat 열이 없어, 원본 코드는 항상 '날짜 형식인 열을 찾지 못했습니다.' 오류로 중단됨
- 위험: 청구내역 시트의 '청구일' 열값이 '20251201'처럼 텍스트로 저장된 경우 NumberFormat 검사만으로는 탐지 불가
- 위험: Range.Value = Range.Value 배열 대입 시 Excel이 내부적으로 boolean으로 캐스팅할 수 있는 엣지 케이스가 존재함
- 위험: lastCol 탐지를 1행(헤더)으로 하여 데이터 열 수와 실제 맞지 않을 수 있음
- 수정 필요: 날짜 열 탐지 로직을 NumberFormat 외에 IsDate() 및 텍스트형 날짜(YYYYMMDD) 패턴까지 확장할 것
- 수정 필요: vbDate 형 값 대입 시 CDbl() 변환을 사용하여 boolean 캐스팅을 명시적으로 방지할 것
- 수정 필요: dateColCount=0일 때 Err.Raise 전 청구내역 시트 등 다른 시트도 탐색 대상에 포함할지 사용자 의도를 재확인할 것

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 NumberFormat에서 'yyyy'/'mm'/'dd' 패턴만 검사하므로, 스키마에서 확인된 '고객정보' 시트의 헤더가 ['회사명','사업자번호','담당자','연락처']로 날짜 서식 열이 없어 항상 Err.Raise로 종료됩니다. 개선안은 NumberFormat 검사에 더해 IsDate()와 '20251201' 형태의 텍스트 날짜까지 탐지하고, vbDate 값은 CDbl()로 숫자 직렬번호 형태로 대입하여 boolean 캐스팅을 방지합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook
    Dim ws As Worksheet
    Dim wb As Workbook

    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then
            Set wbSrc = wb
            Exit For
        End If
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Exit For
    Next wb
    Set ws = Nothing
    Dim sh As Worksheet
    For Each sh In wbSrc.Worksheets
        If sh.Name = "고객정보" Then
            Set ws = sh
            Exit For
        End If
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'고객정보' 시트를 찾지 못했습니다."

    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    If lastRow < 2 Or lastCol < 1 Then Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."

    ' 날짜 열 탐지: 헤더 서식, 데이터 행 서식, IsDate() 판별을 복합 사용
    Dim dateCols() As Long
    ReDim dateCols(1 To lastCol)
    Dim dateColCount As Long: dateColCount = 0
    Dim c As Long

    For c = 1 To lastCol
        Dim nf As String
        Dim cellVal As Variant
        nf = ws.Cells(2, c).NumberFormat
        cellVal = ws.Cells(2, c).Value

        ' 1) NumberFormat 이 날짜/시간 계열인지 확인
        Dim isDateFmt As Boolean: isDateFmt = False
        If InStr(nf, "yyyy") > 0 Or InStr(nf, "yy") > 0 Then isDateFmt = True
        If InStr(nf, "/") > 0 And InStr(nf, "d") > 0 Then isDateFmt = True
        If InStr(nf, "h") > 0 And InStr(nf, "m") > 0 Then isDateFmt = True

        ' 2) 값 자체가 Date 형인지 확인
        Dim isDateVal As Boolean: isDateVal = False
        If IsDate(cellVal) And Not IsEmpty(cellVal) And Not IsNull(cellVal) Then
            isDateVal = True
        End If

        ' 3) 텍스트로 저장된 날짜 형태(예: "20251201") 확인
        Dim isTextDate As Boolean: isTextDate = False
        If VarType(cellVal) = vbString Then
            Dim s As String: s = CStr(cellVal)
            If Len(s) = 8 Then
                If IsNumeric(s) Then
                    Dim yr As Long: yr = CLng(Left(s, 4))
                    Dim mo As Long: mo = CLng(Mid(s, 5, 2))
                    Dim dy As Long: dy = CLng(Right(s, 2))
                    If yr >= 1900 And yr <= 2100 And mo >= 1 And mo <= 12 And dy >= 1 And dy <= 31 Then
                        isTextDate = True
                    End If
                End If
            End If
        End If

        If isDateFmt Or isDateVal Or isTextDate Then
            dateColCount = dateColCount + 1
            dateCols(dateColCount) = c
        End If
    Next c

    If dateColCount = 0 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "날짜 형식인 열을 찾지 못했습니다."
    End If

    ' 날짜 열을 마지막 열 다음으로 복사 — 값과 NumberFormat 모두 이전
    ' boolean 캐스팅 방지를 위해 셀별로 개별 복사
    Dim targetCol As Long
    targetCol = lastCol + 1
    Dim i As Long, r As Long

    For i = 1 To dateColCount
        Dim srcCol As Long: srcCol = dateCols(i)

        ' 헤더 복사
        ws.Cells(1, targetCol).Value = ws.Cells(1, srcCol).Value
        ws.Cells(1, targetCol).NumberFormat = ws.Cells(1, srcCol).NumberFormat

        ' 데이터 행: 셀별로 복사하여 boolean 캐스팅 방지
        For r = 2 To lastRow
            Dim srcCell As Range
            Set srcCell = ws.Cells(r, srcCol)
            Dim dstCell As Range
            Set dstCell = ws.Cells(r, targetCol)

            ' NumberFormat 먼저 적용 후 값 대입 — 날짜 직렬번호가 boolean 으로 해석되지 않도록
            dstCell.NumberFormat = srcCell.NumberFormat

            If IsEmpty(srcCell.Value) Then
                dstCell.Value = ""
            ElseIf VarType(srcCell.Value) = vbDate Then
                ' Date 형은 CDbl 로 숫자 직렬번호로 이전 — boolean 캐스팅 방지
                dstCell.Value = CDbl(srcCell.Value)
            ElseIf VarType(srcCell.Value) = vbString Then
                dstCell.Value = srcCell.Value
            Else
                dstCell.Value = srcCell.Value
            End If
        Next r

        targetCol = targetCol + 1
    Next i

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook
    Dim ws As Worksheet
    Dim wb As Workbook
    
    ' 소스 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then
            Set wbSrc = wb
            Exit For
        End If
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    
    ' 시트 찾기
    Set ws = Nothing
    Dim sh As Worksheet
    For Each sh In wbSrc.Worksheets
        If sh.Name = "고객정보" Then
            Set ws = sh
            Exit For
        End If
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'고객정보' 시트를 찾지 못했습니다."

    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastCol = ws.Cells(1, ws.Columns.Count).End(xlToLeft).Column
    
    If lastRow < 2 Or lastCol < 1 Then Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."

    ' 날짜 형식을 가진 열을 찾아서, 그 열의 데이터를 새로운 열로 복사
    ' 날짜 형식 판단: NumberFormat이 "yyyy-mm-dd" 등 날짜 관련 패턴을 포함하거나, 값이 날짜인 경우
    Dim dateCols() As Long
    ReDim dateCols(1 To lastCol)
    Dim dateColCount As Long: dateColCount = 0
    
    Dim c As Long
    For c = 1 To lastCol
        ' 헤더 행(1행)의 서식을 확인하거나, 데이터 행(2행)의 서식을 확인
        ' 일반적으로 날짜 열은 서식이 날짜 형식임
        Dim nf As String
        nf = ws.Cells(2, c).NumberFormat
        If InStr(nf, "yyyy") > 0 Or InStr(nf, "mm") > 0 Or InStr(nf, "dd") > 0 Then
            dateColCount = dateColCount + 1
            dateCols(dateColCount) = c
        End If
    Next c
    
    If dateColCount = 0 Then
        ' 날짜 형식 열이 없으면, 모든 텍스트/숫자 열을 복사하되, 날짜로 해석될 수 있는 것을 방지
        ' 또는 요청의 의도가 "날짜로 보이는 것"을 그대로 옮기는 것일 수 있음.
        ' 여기서는 날짜 형식 열이 없으면 에러를 내거나, 모든 열을 복사하는 방식으로 변경 가능.
        ' 하지만 "날짜 형태 데이터"라고 명시했으므로, 날짜 형식 열이 없으면 작업 대상이 없음.
        Err.Raise vbObjectError + 513, "B2BSkill", "날짜 형식인 열을 찾지 못했습니다."
    End If
    
    ' 날짜 형식 열들을 마지막 열 다음으로 복사
    Dim targetCol As Long
    targetCol = lastCol + 1
    
    Dim r As Long
    Dim i As Long
    For i = 1 To dateColCount
        Dim srcCol As Long
        srcCol = dateCols(i)
        
        ' 헤더 복사
        ws.Cells(1, targetCol).Value = ws.Cells(1, srcCol).Value
        ws.Cells(1, targetCol).NumberFormat = ws.Cells(1, srcCol).NumberFormat
        
        ' 데이터 복사 (Value 사용으로 서식 보존)
        Dim srcRng As Range, dstRng As Range
        Set srcRng = ws.Range(ws.Cells(2, srcCol), ws.Cells(lastRow, srcCol))
        Set dstRng = ws.Range(ws.Cells(2, targetCol), ws.Cells(lastRow, targetCol))
        
        ' Value를 사용하여 복사 (서식과 값 보존)
        dstRng.Value = srcRng.Value
        dstRng.NumberFormat = srcRng.NumberFormat
        
        targetCol = targetCol + 1
    Next i

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## datetime_format_preserve / preserve_date_on_load — NEEDS_WINDOWS

Prompt:
```text
월별실적 시트에 월 라벨(1월~4월 등) 텍스트가 숫자/참거짓으로 깨지지 않게 그대로 유지해줘.
```
Warnings:
- No value/format-preserving copy detected; result may land as null/empty.
- Sonnet 검수 RISK: 사용자 의도는 '1월~4월 등 텍스트 라벨이 숫자/참거짓으로 깨지지 않게 그대로 유지'하는 것이므로, 이미 깨진 값(날짜 직렬번호, Boolean)을 원래 텍스트로 복원하는 것이 핵심입니다. 그러나 이 코드는 NumberFormat만 '@'로 바꿀 뿐 셀의 실제 저장 값을 건드리지 않으므로, 값이 이미 깨진 경우에는 효과가 없습니다. 반면 값이 이미 올바른 텍스트인 경우에는 no-op에 가깝고 오류 없이 종료되어 PASS처럼 보이지만 진짜 문제 시나리오에서는 기대 결과를 달성하지 못합니다. 따라서 의도 부분 불일치로 RISK 판정합니다.
Needs Windows:
- Verify date/time cells keep their value+number format (not 'false') in Excel.
- Verify pasted cells carry actual values (not null) in real Excel.
- 날짜/시간 셀이 'false'/True 가 아니라 원래 값+표시형식을 유지하는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: \bCBool\b
- Forbidden pattern absent: \.Value2?\s*=\s*(?:True|False)\b
- No boolean cast on date/time data.
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!A4` → NumberFormat='@' (서식만 변경, 값은 '1월' 그대로)
  - `월별실적!A5` → NumberFormat='@' (서식만 변경, 값은 '2월' 그대로)
  - `월별실적!A6` → NumberFormat='@' (서식만 변경, 값은 '3월' 그대로)
  - `월별실적!A7` → NumberFormat='@' (서식만 변경, 값은 '4월' 그대로)
  - `월별실적!D5` → =C5-C4 (수식 그대로 보존)
  - `월별실적!D6` → =C6-C5 (수식 그대로 보존)
  - `월별실적!D7` → =C7-C6 (수식 그대로 보존)
- 근거: 사용자 의도는 '1월~4월 등 텍스트 라벨이 숫자/참거짓으로 깨지지 않게 그대로 유지'하는 것이므로, 이미 깨진 값(날짜 직렬번호, Boolean)을 원래 텍스트로 복원하는 것이 핵심입니다. 그러나 이 코드는 NumberFormat만 '@'로 바꿀 뿐 셀의 실제 저장 값을 건드리지 않으므로, 값이 이미 깨진 경우에는 효과가 없습니다. 반면 값이 이미 올바른 텍스트인 경우에는 no-op에 가깝고 오류 없이 종료되어 PASS처럼 보이지만 진짜 문제 시나리오에서는 기대 결과를 달성하지 못합니다. 따라서 의도 부분 불일치로 RISK 판정합니다.
- 위험: NumberFormat='@' 설정만으로는 이미 날짜 직렬번호나 불리언 값으로 저장된 셀이 복원되지 않음 — 서식은 바뀌지만 값 자체는 그대로 남아 '깨진 값'이 계속 표시될 수 있음
- 위험: A열 값이 Excel 내부에서 이미 숫자나 Boolean으로 변환된 경우 NumberFormat '@' 적용 후에도 45000(날짜 직렬값) 혹은 True/False가 그대로 출력됨
- 위험: 월 라벨이 이미 올바른 텍스트라면 변경 0건 no-op로 끝나 '수정됐다'는 오보를 줄 수 있음
- 수정 필요: NumberFormat 변경 후 각 셀 값을 CStr()로 읽어 동일 셀에 문자열로 재기입해야 날짜/불리언으로 깨진 값도 실제로 복원됨
- 수정 필요: 값 재기입 시 먼저 NumberFormat='@'를 설정하고 그 다음 .Value = CStr(기존값) 순서를 지켜야 Excel이 텍스트로 인식함

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 셀 서식(NumberFormat)만 '@'로 바꿀 뿐, 이미 날짜 직렬값이나 불리언(True/False)으로 저장된 셀의 실제 값은 그대로입니다. 서식만 바꾸면 Excel이 기존 값을 텍스트 형식으로 표시할 뿐, CBool/숫자로 깨진 값이 복원되지 않습니다. 개선안은 NumberFormat을 '@'로 먼저 지정한 뒤 CStr()로 읽어 동일 셀에 문자열로 재기입함으로써 '1월'~'4월' 텍스트가 확실히 저장되도록 합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Exit For
    Next wb
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wb.Worksheets("월별실적")

    Dim hdrRow As Long: hdrRow = 3
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    If lastRow < hdrRow + 1 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."
    End If

    ' A열(월 라벨) 각 셀 값을 읽어 텍스트로 강제 재기입
    Dim i As Long
    For i = hdrRow + 1 To lastRow
        Dim cellVal As String
        cellVal = CStr(ws.Cells(i, 1).Value)
        ws.Cells(i, 1).NumberFormat = "@"
        ws.Cells(i, 1).Value = cellVal
    Next i

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Exit For
    Next wb
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wb.Worksheets("월별실적")

    Dim hdrRow As Long: hdrRow = 3
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    
    If lastRow < hdrRow + 1 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."
    End If

    ' A열(월 라벨)의 데이터 범위를 텍스트 서식으로 설정
    Dim targetRng As Range
    Set targetRng = ws.Range(ws.Cells(hdrRow + 1, 1), ws.Cells(lastRow, 1))
    
    targetRng.NumberFormat = "@"

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## datetime_format_preserve / datetime_no_boolean_cast — NEEDS_WINDOWS

Prompt:
```text
데이터를 옮기되 날짜/시간 셀에 CBool 같은 불리언 변환을 절대 쓰지 마. 원래 값이 살아있어야 해.
```
Warnings:
- No value/format-preserving copy detected; result may land as null/empty.
- Sonnet 검수 RISK: 코드는 COM 환경에서 런타임 오류 없이 실행되지만, 날짜/시간 값을 Value2 배열로 일괄 쓰는 방식은 직렬번호(Double)로 변환되어 서식이 소멸하고 '원래 값 보존' 의도에 부합하지 않습니다. 또한 wsSrc.Calculate 가 srcArr 읽기 이후에 위치해 재계산 효과가 배열에 반영되지 않을 수 있습니다. 사용자 요청의 핵심인 날짜/시간 원본 값 보존이 충분히 보장되지 않으므로 RISK로 판정합니다.
Needs Windows:
- Verify date/time cells keep their value+number format (not 'false') in Excel.
- Verify pasted cells carry actual values (not null) in real Excel.
- 날짜/시간 셀이 'false'/True 가 아니라 원래 값+표시형식을 유지하는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: \bCBool\b
- Forbidden pattern absent: \.Value2?\s*=\s*(?:True|False)\b
- No boolean cast on date/time data.
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 아니오 · 수식 보존: 아니오
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `값복사_대상!A2` → 국제콜_A (문자열)
  - `값복사_대상!B2` → 3 (숫자)
  - `값복사_대상!C2` → 1200 (숫자)
  - `값복사_대상!D2` → 3600 (계산된 숫자값 — 수식 =B2*C2 가 사라짐)
  - `값복사_대상!E2` → 수식 결과 3600만 복사 (비고 문자열)
  - `값복사_대상!A3` → 국내콜_B (문자열)
  - `값복사_대상!D3` → 4000 (계산된 숫자값 — 수식 =B3*C3 가 사라짐)
  - `값복사_대상!G2` → (변경 없음 — 기존 수식 =ROW()*100 유지)
  - `값복사_대상!H2` → (변경 없음 — 기존 수식 =ROW()*999 유지)
- 근거: 코드는 COM 환경에서 런타임 오류 없이 실행되지만, 날짜/시간 값을 Value2 배열로 일괄 쓰는 방식은 직렬번호(Double)로 변환되어 서식이 소멸하고 '원래 값 보존' 의도에 부합하지 않습니다. 또한 wsSrc.Calculate 가 srcArr 읽기 이후에 위치해 재계산 효과가 배열에 반영되지 않을 수 있습니다. 사용자 요청의 핵심인 날짜/시간 원본 값 보존이 충분히 보장되지 않으므로 RISK로 판정합니다.
- 위험: srcArr = Range.Value 로 읽은 배열에는 날짜가 VBA Date 타입이 아닌 Double(직렬번호)로 들어갈 수 있으며, 이를 dstRng.Value2 = srcArr 로 쓰면 날짜 서식이 사라지고 숫자로 표시됨
- 위험: Value2 로 쓸 경우 원본 NumberFormat(날짜/시간 서식)이 대상 셀에 복원되지 않아 '원래 값 살아있어야 한다'는 요구를 충족하지 못함
- 위험: 소스 시트의 D열 수식(=B2*C2 등)은 srcArr.Value 로 읽으면 이미 계산값(3600 등)으로 치환되어 대상에 수식 없이 숫자만 들어감 — 이 자체는 값복사 목적에 부합하나, 원본 수식 보존을 원하면 별도 처리 필요
- 위험: wsSrc.Calculate 호출이 dstRng.Value2 = srcArr 이후가 아닌 이전에 배치되어 있으나, 배열은 이미 Calculate 전에 읽혔기 때문에 재계산 효과가 srcArr 에 반영되지 않을 수 있음 (Calculate 는 srcArr 읽기 이후에 위치해야 의미 있음)
- 수정 필요: 날짜/시간 셀은 .Value2 배열 일괄 쓰기 대신 셀 단위로 .Value 와 NumberFormat 을 함께 복원해야 함
- 수정 필요: wsSrc.Calculate 를 srcArr 읽기 이전으로 이동시켜 수식 결과가 배열에 올바르게 담기도록 해야 함
- 수정 필요: 대상 시트 기존 셀(G2:H6의 =ROW()*999 수식 등)의 보존 여부를 명시적으로 고려해야 하며, 소스 열 수(lastColSrc=5)가 대상의 기존 수식 열(G, H)을 덮지 않는지 확인 필요

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 srcArr = wsSrc.Range(...).Value 로 배열을 읽은 뒤 dstRng.Value2 = srcArr 로 일괄 쓰는데, 이 경우 날짜/시간 셀이 Value2(숫자 직렬번호)로 내려가 서식이 깨지고, 사용자가 요청한 '원래 값 보존'에서 벗어납니다. 개선안은 셀 단위로 순회하면서 날짜/시간 포맷 셀은 .Value + NumberFormat 을 유지하고, 수식 셀은 계산값(.Value2)으로 쓰며, CBool 등 불리언 변환이 개입할 여지를 완전히 차단합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation
    prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook

    For Each wb In Application.Workbooks
        If wb.Name = "input_v058_regression_source.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_v058_regression_source.xlsx' 가 열려 있지 않습니다."

    For Each wb In Application.Workbooks
        If wb.Name = "output_v058_regression_target.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_v058_regression_target.xlsx' 가 열려 있지 않습니다."

    Set wsSrc = wbSrc.Worksheets("값복사_수식원본")
    Set wsDst = wbDst.Worksheets("값복사_대상")

    ' 날짜/시간 수식 결과를 정확히 얻기 위해 먼저 재계산
    wsSrc.Calculate

    Dim lastRowSrc As Long, lastColSrc As Long
    lastRowSrc = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    lastColSrc = wsSrc.Cells(1, wsSrc.Columns.Count).End(xlToLeft).Column
    If lastRowSrc < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "소스 데이터가 없습니다."

    ' 헤더를 제외한 데이터 행 순회하며 셀 단위로 복사
    ' → 날짜/시간 셀은 .Value2(숫자 직렬번호)가 아닌 .Value 로 읽어 그대로 쓴다
    ' → 수식 셀은 .Value(계산값)를 쓰고, 원본 수식이 필요한 경우 .Formula 를 쓴다
    Dim r As Long, c As Long
    For r = 2 To lastRowSrc
        For c = 1 To lastColSrc
            Dim srcCell As Range
            Set srcCell = wsSrc.Cells(r, c)
            Dim dstCell As Range
            Set dstCell = wsDst.Cells(r, c)
            ' 날짜/시간 형식 여부를 NumberFormat 으로 확인
            Dim fmt As String
            fmt = srcCell.NumberFormat
            If InStr(fmt, "yy") > 0 Or InStr(fmt, "mm") > 0 Or InStr(fmt, "dd") > 0 Or _
               InStr(fmt, "hh") > 0 Or InStr(fmt, "ss") > 0 Then
                ' 날짜/시간: .Value 로 Date 타입 그대로 이동, CBool 미사용
                dstCell.Value = srcCell.Value
                dstCell.NumberFormat = fmt
            ElseIf srcCell.HasFormula Then
                ' 수식 셀: 계산된 값만 붙여넣기 (Value2 로 숫자 직렬번호 보존)
                dstCell.Value2 = srcCell.Value2
            Else
                ' 일반 텍스트/숫자: 그대로
                dstCell.Value = srcCell.Value
            End If
        Next c
    Next r

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook

    ' 소스 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_v058_regression_source.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_v058_regression_source.xlsx' 가 열려 있지 않습니다."

    ' 대상 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "output_v058_regression_target.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_v058_regression_target.xlsx' 가 열려 있지 않습니다."

    ' 소스 시트 설정
    Set wsSrc = wbSrc.Worksheets("값복사_수식원본")
    
    ' 대상 시트 설정
    Set wsDst = wbDst.Worksheets("값복사_대상")

    ' 소스 데이터 범위 확인 (헤더 제외 데이터만)
    Dim lastRowSrc As Long, lastColSrc As Long
    lastRowSrc = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    lastColSrc = wsSrc.Cells(1, wsSrc.Columns.Count).End(xlToLeft).Column
    
    If lastRowSrc < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "소스 데이터가 없습니다."

    ' 소스 데이터 배열 읽기 (A2:D6 가정, 실제 마지막 열까지)
    Dim srcArr As Variant
    srcArr = wsSrc.Range(wsSrc.Cells(2, 1), wsSrc.Cells(lastRowSrc, lastColSrc)).Value

    ' 대상 시트에서 소스 데이터가 있는 행/열만큼의 범위 지정
    Dim dstRng As Range
    Set dstRng = wsDst.Range(wsDst.Cells(2, 1), wsDst.Cells(UBound(srcArr, 1) + 1, UBound(srcArr, 2)))

    ' 소스 시트 계산 강제 (수식 결과 값 확보)
    wsSrc.Calculate
    
    ' 값만 복사 (Value2 사용으로 날짜/시간 등 원본 값 보존, 불리언 변환 금지)
    dstRng.Value2 = srcArr

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_cell_value_copy_null / copy_formula_result_elsewhere — NEEDS_WINDOWS

Prompt:
```text
회사별요약에서 마진이 들어있는 D4:D23 값을 같은 시트 G4:G23으로 옮겨줘. 옮긴 결과가 빈칸(null)이 되지 않게 실제 값이 들어가야 해.
```
Needs Windows:
- Verify pasted cells carry actual values (not null) in real Excel.
- 복사 결과 셀이 null/빈값이 아니라 실제 마진 값/수식을 담는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: \.Value2?\s*=\s*Empty\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Copies source .Value into destination .Value (value carried).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!G4` → D4의 계산값(예: B4-C4 결과 숫자)
  - `회사별요약!G5` → D5의 계산값(예: B5-C5 결과 숫자)
  - `회사별요약!G6` → D6의 계산값 숫자
  - `회사별요약!G23` → D23의 계산값 숫자
  - `회사별요약!D4` → =B4-C4 (수식 그대로 보존)
  - `회사별요약!D5` → =B5-C5 (수식 그대로 보존)
  - `회사별요약!D24` → =SUM(D4:D23) (수식 그대로 보존, 변경 없음)
- 근거: 코드는 ws.Calculate로 수식을 강제 계산한 뒤 srcRng.Value2를 dstRng.Value2에 배열 대입하는 방식으로, D4:D23의 수식 계산 결과값(숫자)을 G4:G23에 올바르게 씁니다. 원본 D열 수식(=B4-C4 등)은 읽기만 하고 수정하지 않으므로 보존됩니다. 대상 워크북·시트를 명시적으로 찾고, 없으면 Err.Raise로 드러내며, On Error Resume Next 없이 에러를 전파합니다. expected 조건(G4:G23에 실제 계산값, D열 수식 보존)을 모두 충족합니다.
- 위험: G4:G23에 기존 수식이나 내용이 있었다면 Value2 대입으로 덮어씌워짐(단, 사용자 요청 자체가 값 쓰기이므로 허용 범위)
- 위험: ws.Calculate 호출 후 Application.Calculation = xlCalculationManual 상태에서 Value2를 읽으므로, B/C열이 아직 채워지지 않았다면 G열에 0이 들어갈 수 있음(데이터 의존적)
- 위험: G열에 병합셀이 있을 경우 1004 오류 가능성(현재 스키마상 병합 없음이므로 낮음)

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim ws As Worksheet
    
    ' 대상 워크북 찾기
    Dim wbFound As Workbook
    For Each wbFound In Application.Workbooks
        If wbFound.Name = "output_청구서_템플릿.xlsx" Then
            Set wb = wbFound
            Exit For
        End If
    Next wbFound
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    
    ' 대상 시트 찾기
    Dim wsFound As Worksheet
    For Each wsFound In wb.Worksheets
        If wsFound.Name = "회사별요약" Then
            Set ws = wsFound
            Exit For
        End If
    Next wsFound
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."
    
    ' D4:D23의 값을 읽어서 G4:G23에 쓰기
    ' 수식 셀의 계산된 값을 복사하려면 먼저 시트를 계산해야 함
    ws.Calculate
    
    Dim srcRng As Range
    Dim dstRng As Range
    Set srcRng = ws.Range("D4:D23")
    Set dstRng = ws.Range("G4:G23")
    
    ' Value2를 사용하여 수식이 아닌 계산된 값만 복사
    dstRng.Value2 = srcRng.Value2

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_cell_value_copy_null / move_block_keep_values — WARN

Prompt:
```text
회사별요약 B3:E23 영역을 같은 시트 H열 쪽으로 복사하는데, 마진/마진율 수식 셀의 계산 결과가 null로 들어가는 문제가 없게 해줘. 값과 서식이 그대로 보여야 해.
```
Warnings:
- No value/format-preserving copy detected; result may land as null/empty.
- Sonnet 검수 RISK: 코드는 COM 환경에서 런타임 오류 없이 실행되지만, Application.Calculation = xlCalculationManual로 설정한 뒤 바로 PasteSpecial(Values)를 수행하면 마진/마진율 수식 셀이 재계산되지 않은 채 0 또는 null로 복사될 수 있어 사용자가 호소한 바로 그 문제가 재현됩니다. 이는 의도(null 방지)와 반대되는 동작이므로 RISK로 판정합니다. 서식 복사(xlPasteFormats) 자체는 올바르게 구현되어 있습니다.
Needs Windows:
- Verify pasted cells carry actual values (not null) in real Excel.
- 복사 결과 셀이 null/빈값이 아니라 실제 마진 값/수식을 담는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: \.Value2?\s*=\s*Empty\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!H3` → '회사명' (값)
  - `회사별요약!I3` → '매출' (값)
  - `회사별요약!J3` → '원가' (값)
  - `회사별요약!K3` → '마진' (값, 수식 아님)
  - `회사별요약!H4` → 'ABC통신' (값)
  - `회사별요약!I4` → '' (빈값, 매출 데이터 없으면 0 또는 빈값)
  - `회사별요약!J4` → '' (빈값, 원가 데이터 없으면 0 또는 빈값)
  - `회사별요약!K4` → 수식 계산 결과값 (예: 0 또는 실제 마진 숫자), 수식 =B4-C4 는 사라짐
  - `회사별요약!L4` → 마진율 계산 결과값 (예: 0 또는 실제 비율), 수식 =IFERROR(D4/B4,0) 는 사라짐 — 그런데 L열은 dstRng 범위 밖(H3:K23은 4열이므로 K열까지). E열 마진율은 K+1=L열이 아닌 K열에 붙여짐
  - `회사별요약!K24` → (범위 밖 — dstRng가 H3:K23이므로 24행은 미포함, SUM/AVERAGE 합계행 복사 안 됨)
  - `회사별요약!H24` → (변경 없음 — 미포함)
- 근거: 코드는 COM 환경에서 런타임 오류 없이 실행되지만, Application.Calculation = xlCalculationManual로 설정한 뒤 바로 PasteSpecial(Values)를 수행하면 마진/마진율 수식 셀이 재계산되지 않은 채 0 또는 null로 복사될 수 있어 사용자가 호소한 바로 그 문제가 재현됩니다. 이는 의도(null 방지)와 반대되는 동작이므로 RISK로 판정합니다. 서식 복사(xlPasteFormats) 자체는 올바르게 구현되어 있습니다.
- 위험: xlCalculationManual 상태에서 srcRng.Copy → PasteSpecial(Values) 시, 마진/마진율 수식 셀(D4:E23)이 아직 재계산되지 않아 0 또는 빈값으로 복사될 수 있음 — 이것이 사용자가 호소한 null 문제의 직접 원인
- 위험: dstRng를 ws.Range("H3:K23")로 지정하면 소스(B3:E23, 4열×21행)와 크기가 동일하므로 오류는 없으나, PasteSpecial은 시작 셀 하나(H3)만 줘도 자동 확장되므로 불필요한 범위 지정이 혼란을 줄 수 있음
- 위험: srcRng B3:E23이 21행(3~23)인데 24행의 SUM/AVERAGE 합계행은 포함되지 않아 합계행이 H열에 복사되지 않음 — 사용자 요청(B3:E23)에는 부합하지만 24행 합계가 누락될 수 있음을 인지해야 함
- 위험: 회사별요약 시트에 병합 셀(A1:E1)이 있으나 H~K 영역에는 병합 없으므로 1004 오류 가능성은 낮음
- 수정 필요: srcRng.Copy 직전에 Application.Calculation = xlCalculationAutomatic 및 Application.Calculate를 호출하여 수식 셀이 완전히 계산된 상태에서 값 복사가 이루어지도록 수정 — null/0 복사 문제의 근본 해결
- 수정 필요: dstRng 지정을 ws.Range("H3") 단일 셀로 변경하여 PasteSpecial 크기 불일치 위험 제거

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_핵심 개선점은 두 가지입니다. 첫째, 원본 코드가 dstRng를 ws.Range("H3:K23")로 명시적으로 지정했는데, PasteSpecial은 붙여넣기 시작 셀 하나만 지정해도 소스 범위 크기대로 자동 확장되므로, 시작 셀 H3만 지정하면 충분합니다(범위를 잘못 지정하면 크기 불일치 오류 1004 위험). 둘째, COM의 xlCalculationManual 상태에서 Copy→PasteSpecial(Values)를 하면 수식 셀이 아직 계산 전일 경우 0이나 null로 복사될 수 있으므로, Copy 직전에 xlCalculationAutomatic + Application.Calculate로 강제 재계산 후 다시 Manual로 전환하는 패턴이 null 오류를 방지합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")

    ' 소스 범위: B3:E23 — 헤더(3행) + 데이터(4~23행), 마진/마진율 수식 포함
    ' 요청 범위: B3:E23 → H열 시작이므로 H3:K23
    Dim srcRng As Range
    Set srcRng = ws.Range("B3:E23")

    ' 재계산 강제: 수식 셀이 null/0으로 보이는 문제 방지
    Application.Calculation = xlCalculationAutomatic
    Application.Calculate
    Application.Calculation = xlCalculationManual

    ' 전체 복사 후 값+서식만 PasteSpecial
    ' 마진(D열)과 마진율(E열)은 수식 결과(계산된 숫자)로 고정 복사
    srcRng.Copy

    Dim dstRng As Range
    Set dstRng = ws.Range("H3")

    ' 값 붙여넣기 — 수식 계산 결과가 실제 숫자로 기록됨 (null 방지)
    dstRng.PasteSpecial Paste:=xlPasteValues
    ' 서식 붙여넣기 — 숫자 서식/셀 색상 등 보존
    dstRng.PasteSpecial Paste:=xlPasteFormats

    Application.CutCopyMode = False

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")

    ' 소스 범위: B3:E23 (헤더 포함)
    Dim srcRng As Range
    Set srcRng = ws.Range("B3:E23")
    
    ' 대상 범위: H3:K23 (H열 시작, 열 개수 4개)
    Dim dstRng As Range
    Set dstRng = ws.Range("H3:K23")

    ' 1. 전체 복사 (수식 포함)
    srcRng.Copy
    
    ' 2. 값만 붙여넣기 (수식 제거, 계산 결과 고정)
    dstRng.PasteSpecial Paste:=xlPasteValues
    
    ' 3. 서식만 붙여넣기 (서식 보존)
    dstRng.PasteSpecial Paste:=xlPasteFormats

    Application.CutCopyMode = False

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: WARN

## formula_cell_value_copy_null / paste_special_values — NEEDS_WINDOWS

Prompt:
```text
회사별요약 합계행(24행)의 SUM/AVERAGE 결과를 같은 시트 다른 위치에 '값으로' 붙여넣어줘. 수식 결과 숫자가 그대로 들어가야 하고 null이면 안 돼.
```
Warnings:
- Sonnet 검수 RISK: 코드 자체는 COM 런타임에서 오류 없이 실행될 가능성이 높고, 원본 24행 수식(D24, E24)을 보존하며 값만 복사하는 핵심 로직은 올바릅니다. 그러나 붙여넣을 대상 위치(F4:G4)가 사용자 요청에 전혀 명시되지 않았음에도 임의로 결정되었고, 이 위치가 기존 데이터를 덮어쓸 수 있어 의도 부합이 불완전합니다. 또한 복사 범위가 D24:E24(2개 셀)로 한정되어 '24행 합계행' 전체를 옮기는 것으로 해석할 경우 과소 복사에 해당합니다.
Needs Windows:
- Verify pasted cells carry actual values (not null) in real Excel.
- 복사 결과 셀이 null/빈값이 아니라 실제 마진 값/수식을 담는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: \.Value2?\s*=\s*Empty\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Copies source .Value into destination .Value (value carried).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 아니오 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!D24` → =SUM(D4:D23) (수식 그대로 보존)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 그대로 보존)
  - `회사별요약!F4` → D24의 계산 결과값 (숫자, 예: SUM 결과)
  - `회사별요약!G4` → E24의 계산 결과값 (숫자, 예: AVERAGE 결과)
- 근거: 코드 자체는 COM 런타임에서 오류 없이 실행될 가능성이 높고, 원본 24행 수식(D24, E24)을 보존하며 값만 복사하는 핵심 로직은 올바릅니다. 그러나 붙여넣을 대상 위치(F4:G4)가 사용자 요청에 전혀 명시되지 않았음에도 임의로 결정되었고, 이 위치가 기존 데이터를 덮어쓸 수 있어 의도 부합이 불완전합니다. 또한 복사 범위가 D24:E24(2개 셀)로 한정되어 '24행 합계행' 전체를 옮기는 것으로 해석할 경우 과소 복사에 해당합니다.
- 위험: dstRng이 F4:G4로 하드코딩되어 있는데, F4·G4가 기존 데이터(수식 포함)를 가지고 있다면 덮어쓰기가 발생함. 스키마에서 E4까지만 정의되어 있어 F·G열 존재 여부가 불확실함.
- 위험: 붙여넣을 위치(F4:G4)가 사용자 요청에 명시되지 않았음에도 코드가 임의로 결정함. 실제 의도한 위치와 다를 수 있음.
- 위험: D24:E24만 복사하므로 24행의 다른 열(A~C) 합계/라벨은 누락됨. 사용자가 '24행 합계행 전체'를 원했다면 부분 복사에 그침.
- 위험: ws.Calculate 후 Application.Calculation이 xlCalculationManual 상태이므로, B/C열이 아직 채워지지 않았다면 D24(SUM), E24(AVERAGE) 결과가 0 또는 빈값일 수 있음.
- 수정 필요: 붙여넣을 대상 위치(dstRng)를 사용자와 협의하거나 스키마에서 명시된 빈 위치로 변경해야 함. F4:G4는 임의 지정이라 부적절함.
- 수정 필요: srcRng 범위를 A24:E24 등 24행 전체로 확장하거나, 최소한 SUM(D24)·AVERAGE(E24) 외에 라벨(A24)도 포함할지 사용자에게 확인 필요.

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드가 dstRng을 F4:G4로 고정했는데, 이는 사용자가 요청한 '같은 시트 다른 위치'를 임의로 결정한 것이며 스키마에서 F열·G열이 빈 열인지도 확인되지 않습니다. 또한 srcRng이 D24:E24(SUM/AVERAGE 셀만)이지만 사용자가 '24행 합계행 전체 결과'를 원한다면 라벨(A24)도 포함하는 편이 자연스럽습니다. 개선안은 26행으로 대상을 변경하고 병합셀 사전 검사를 추가해 1004 오류를 방지합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbDst.Worksheets("회사별요약")

    ' 수식 결과를 확정하기 위해 계산 강제
    ws.Calculate

    ' 24행 전체(A24:E24) 값을 읽어 다음 빈 행(26행)에 값으로 붙여넣기
    ' ※ 붙여넣을 위치는 요청에 '같은 시트 다른 위치'로만 명시됨 → 26행 A열 기준으로 설정
    Dim srcRng As Range, dstRng As Range
    Set srcRng = ws.Range("A24:E24")   ' 합계행 전체 (라벨 + SUM/AVERAGE 결과)
    Set dstRng = ws.Range("A26:E26")   ' 값으로 붙여넣을 대상 위치 (26행)

    ' 병합셀 여부 확인 (1004 방지)
    If dstRng.MergeCells Then
        Err.Raise vbObjectError + 514, "B2BSkill", "대상 범위(A26:E26)에 병합셀이 있어 값을 쓸 수 없습니다."
    End If

    ' Value2 사용: 날짜/통화 서식 영향 없이 순수 숫자값 복사
    dstRng.Value2 = srcRng.Value2

    ' 결과 검증: D24(SUM), E24(AVERAGE) 결과가 null이 아닌지 확인
    If IsEmpty(ws.Range("D26").Value) Or IsEmpty(ws.Range("E26").Value) Then
        Err.Raise vbObjectError + 513, "B2BSkill", "복사된 값이 비어 있습니다. 원본 수식 결과를 확인하세요."
    End If

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbDst.Worksheets("회사별요약")

    Dim srcRng As Range, dstRng As Range
    Set srcRng = ws.Range("D24:E24") ' 합계행 수식 셀 (D24: SUM, E24: AVERAGE)
    Set dstRng = ws.Range("F4:G4")   ' 값으로 붙여넣을 대상 위치

    ' 수식 결과를 확정하기 위해 계산 강제
    ws.Calculate

    ' 값만 복사 (수식/서식 제외)
    dstRng.Value = srcRng.Value2

    ' 결과 검증 (null/빈값 방지)
    If IsEmpty(dstRng.Cells(1, 1).Value) Or IsEmpty(dstRng.Cells(1, 2).Value) Then
        Err.Raise vbObjectError + 513, "B2BSkill", "복사된 값이 비어 있습니다."
    End If

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_copy_preserve / copy_formula_block_same_sheet — NEEDS_WINDOWS

Prompt:
```text
회사별요약에서 수식과 서식이 있는 A3:E23 범위를 같은 시트 H3:L23에 그대로 복사해줘. 값만 복사하지 말고 마진/마진율 수식과 서식도 유지해.
```
Needs Windows:
- Formula preservation requires real Excel workbook diff.
- 복사 대상이 마진/마진율 수식과 테두리/숫자서식을 모두 유지하는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 수식/서식 보존 Excel 복사.
- Forbidden pattern absent: \.Value\s*=\s*[^\n]*\.Value
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+Worksheets
- Uses Excel copy/paste style preserving formulas and formats.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!H3` → 회사명 (헤더, 서식 포함 복사)
  - `회사별요약!I3` → 매출 (헤더, 서식 포함 복사)
  - `회사별요약!J3` → 원가 (헤더, 서식 포함 복사)
  - `회사별요약!K3` → 마진 (헤더, 서식 포함 복사)
  - `회사별요약!L3` → 마진율 (헤더, 서식 포함 복사)
  - `회사별요약!K4` → =B4-C4 (수식 그대로, 상대참조이므로 H4:L4 기준으로 오프셋 이동 → 실제로는 =H4-I4)
  - `회사별요약!L4` → =IFERROR(D4/B4,0) → 상대참조 이동 후 =IFERROR(K4/I4,0)
  - `회사별요약!K24` → =SUM(D4:D23) → 상대참조 이동 후 =SUM(K4:K23)
  - `회사별요약!L24` → =AVERAGE(E4:E23) → 상대참조 이동 후 =AVERAGE(L4:L23)
- 근거: srcRng.Copy Destination:=dstRng 방식은 수식·서식·병합을 모두 포함하여 복사하므로 사용자 요청(수식과 서식 유지 복사)에 정확히 부합한다. 대상 시트도 회사별요약으로 올바르게 지정되었고, 범위도 A3:E23 → H3:L23으로 의도와 일치한다. On Error GoTo Cleanup + Err.Raise 구조로 에러를 숨기지 않고 드러내며, 금지 패턴(On Error Resume Next, MsgBox 등)도 없다. 수식 상대참조가 +7열 이동하는 것은 '그대로 복사'의 자연스러운 동작으로 의도에 부합한다.
- 위험: A3:E23을 H3:L23으로 Copy Destination 하면 수식의 상대참조가 자동으로 열 오프셋(+7열) 이동하므로, 마진 수식이 =B4-C4에서 =H4-I4로 바뀜. 이는 복사된 블록 내 내부 참조로 올바르게 동작하지만, 만약 원본 A:E 열을 참조하도록 유지해야 했다면 절대참조 문제가 생김. 이번 요청(그대로 복사)에서는 의도에 부합.
- 위험: A1:E1 병합셀이 존재하나 복사 대상 시작이 A3이므로 병합셀 충돌 가능성은 낮음. 단, H1:L1 영역에 기존 병합이 없는지 확인 필요.
- 위험: Copy Destination 방식은 클립보드를 사용하므로 폐쇄망 저사양 PC에서 클립보드 잠금/충돌이 간헐적으로 발생할 수 있으나 일반적으로 문제없음.

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")

    Dim srcRng As Range, dstRng As Range
    Set srcRng = ws.Range("A3:E23")
    Set dstRng = ws.Range("H3:L23")

    ' 전체 복사 (수식, 서식, 값 모두 포함)
    srcRng.Copy Destination:=dstRng

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_copy_preserve / duplicate_template_block — NEEDS_WINDOWS

Prompt:
```text
회사별요약의 A:E 양식을 오른쪽으로 한 번 더 복제해줘. 마진/마진율 수식, 테두리, 숫자서식이 유지되어야 해.
```
Needs Windows:
- Formula preservation requires real Excel workbook diff.
- 복사 대상이 마진/마진율 수식과 테두리/숫자서식을 모두 유지하는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 수식/서식 보존 Excel 복사.
- Forbidden pattern absent: \.Value\s*=\s*[^\n]*\.Value
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+Worksheets
- Uses Excel copy/paste style preserving formulas and formats.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!F1` → A1:E1 병합셀 제목이 복제됨 (F1:J1 병합 또는 유사 서식으로)
  - `회사별요약!F3` → '회사명' (헤더 텍스트, 서식 포함)
  - `회사별요약!G3` → '매출'
  - `회사별요약!H3` → '원가'
  - `회사별요약!I3` → '마진'
  - `회사별요약!J3` → '마진율'
  - `회사별요약!I4` → =G4-H4 (D4=B4-C4 에서 열 참조가 +5 이동)
  - `회사별요약!J4` → =IFERROR(I4/G4,0) (E4=IFERROR(D4/B4,0) 에서 열 참조 +5 이동)
  - `회사별요약!I24` → =SUM(I4:I23) (D24=SUM(D4:D23) 에서 열 참조 +5 이동)
  - `회사별요약!J24` → =AVERAGE(J4:J23) (E24=AVERAGE(E4:E23) 에서 열 참조 +5 이동)
- 근거: ws.Columns("A:E").Copy Destination:=ws.Columns("F") 는 Excel의 네이티브 Copy 메서드를 사용하므로 수식·서식·테두리·숫자서식·병합셀이 모두 보존된다. 수식의 상대 참조도 +5열로 자동 조정되어 F:J 블록 내에서 올바르게 동작한다. On Error GoTo Cleanup 구조로 오류를 Err.Raise로 재전파하며, 금지 패턴(On Error Resume Next, MsgBox 등)도 없다. expected 조건인 'Copy로 복제, 값-투-값 복사 아님'을 완전히 충족한다.
- 위험: A1:E1 병합셀이 F열로 복사될 때 F1:J1 병합이 생성되면서 기존 F1 영역에 데이터가 있을 경우 1004 오류 가능(현재 시트에는 기존 F:J 데이터가 없으므로 문제없음)
- 위험: 열 복사 시 수식의 상대 참조가 자동으로 +5열 조정되므로, 원본 A:E 블록의 수식이 F:J 내부 참조로 바뀜 — 의도가 '독립 복제'라면 올바르나, 원본 데이터(B/C열 매출·원가)를 그대로 참조해야 한다면 참조 열이 G/H로 이동되어 빈 셀 참조가 됨. 그러나 사용자 요청이 '양식 복제'이므로 상대 참조 이동은 의도에 부합함
- 위험: 저사양 COM 환경에서 Columns.Copy 는 일반적으로 안정적이나, 열 전체 복사는 대용량 시트에서 메모리 부하가 있을 수 있음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook, ws As Worksheet
    ' 대상 파일 찾기
    Dim wbFound As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            Set wbFound = wb
            Exit For
        End If
    Next wb
    If wbFound Is Nothing Then
        Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    End If

    ' 대상 시트 찾기
    Dim wsFound As Worksheet
    Dim sh As Worksheet
    For Each sh In wbFound.Worksheets
        If sh.Name = "회사별요약" Then
            Set wsFound = sh
            Exit For
        End If
    Next sh
    If wsFound Is Nothing Then
        Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."
    End If
    Set ws = wsFound

    ' A:E 열 전체를 복사하여 F 열에 붙여넣기 (수식, 서식, 테두리 유지)
    ' 열 단위로 복사하면 행 길이에 상관없이 전체가 복사되며, 수식 참조가 자동으로 조정됨
    ws.Columns("A:E").Copy Destination:=ws.Columns("F")

    Application.CutCopyMode = False

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_copy_preserve / new_sheet_preserve_formulas — NEEDS_WINDOWS

Prompt:
```text
회사별요약과 동일한 새 시트를 하나 만들고, 원본 시트의 마진/마진율 수식 셀도 null이 아니라 수식 그대로 복사되게 해줘.
```
Needs Windows:
- Formula preservation requires real Excel workbook diff.
- 복사 대상이 마진/마진율 수식과 테두리/숫자서식을 모두 유지하는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 수식/서식 보존 Excel 복사.
- Forbidden pattern absent: \.Value\s*=\s*[^\n]*\.Value
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+Worksheets
- Uses Excel copy/paste style preserving formulas and formats.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약_복사본!A1:E1` → 병합 셀 그대로 유지 (A1:E1 병합)
  - `회사별요약_복사본!D4` → =B4-C4 (수식 그대로)
  - `회사별요약_복사본!E4` → =IFERROR(D4/B4,0) (수식 그대로)
  - `회사별요약_복사본!D5` → =B5-C5 (수식 그대로)
  - `회사별요약_복사본!E5` → =IFERROR(D5/B5,0) (수식 그대로)
  - `회사별요약_복사본!D24` → =SUM(D4:D23) (수식 그대로)
  - `회사별요약_복사본!E24` → =AVERAGE(E4:E23) (수식 그대로)
- 근거: wsSrc.Copy After:= 방식은 Excel 내장 시트 복사로 수식, 서식, 병합, 이름 범위까지 모두 그대로 복제되므로 D/E 열의 마진 수식이 null이 아닌 수식 그대로 유지된다. 중복 이름 검사 후 복사하므로 덮어쓰기 위험도 없으며, 복사 후 마지막 시트 이름을 지정하는 로직도 정확하다. On Error GoTo Cleanup + Err.Raise 패턴으로 오류를 조용히 삼키지 않고 드러내며, MsgBox·Save 등 금지 패턴도 없다. 전반적으로 사용자 요청 의도를 안전하게 달성한다.
- 위험: 중복 시트명 검사 시 Err.Raise로 즉시 중단되므로, 이미 '회사별요약_복사본'이 존재하면 복사가 수행되지 않는다. 이는 의도된 동작이나, 운영 중 재실행 시 혼란을 줄 수 있다.
- 위험: wsSrc.Copy After:= 실행 후 COM이 복사 시트를 활성 워크북이 아닌 다른 컨텍스트에서 생성하는 경우(드문 COM 버그)에는 wb.Worksheets.Count가 기대와 다를 수 있으나, 실제로는 거의 발생하지 않는다.

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    
    Dim wsSrc As Worksheet
    Set wsSrc = wb.Worksheets("회사별요약")
    
    ' 기존에 같은 이름의 시트가 있는지 확인 (중복 방지)
    Dim sh As Worksheet
    Dim targetName As String: targetName = "회사별요약_복사본"
    For Each sh In wb.Worksheets
        If sh.Name = targetName Then
            Err.Raise vbObjectError + 513, "B2BSkill", "이미 '" & targetName & "' 시트가 존재합니다."
        End If
    Next sh
    
    ' 시트 복사 (맨 뒤에 추가)
    wsSrc.Copy After:=wb.Worksheets(wb.Worksheets.Count)
    
    ' 복사된 시트 이름 변경 (복사 직후 맨 마지막 시트가 됨)
    wb.Worksheets(wb.Worksheets.Count).Name = targetName

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_download_preserve / fill_inputs_preserve_formula_cols — NEEDS_WINDOWS

Prompt:
```text
회사별요약 시트에서 매출(B)과 원가(C) 빈칸만 채워줘. 마진(D), 마진율(E), 합계행 수식은 있으니까 절대 값으로 덮어쓰지 마.
```
Warnings:
- Sonnet 검수 RISK: D열·E열 수식은 건드리지 않아 보존되지만, 합계행(24행) 범위 산정 오류로 B24·C24에 0이 기입될 수 있고, 매칭 안 된 회사에도 0을 쓰는 문제가 있습니다. '빈칸만 채워달라'는 의도와 달리 전체 범위를 배열로 덮어쓰는 방식이라 부분적 범위 오염 위험이 있어 RISK로 판정합니다.
Needs Windows:
- Formula preservation requires real Excel workbook diff.
- Download formula preservation is validated by Excel/openpyxl workbook diff, not static code alone.
- 회사별요약 B/C 만 채워지고 D(마진)/E(마진율)/24행 합계 수식이 그대로 재계산되는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Scripting.Dictionary usage is allowed.
- Forbidden pattern absent: \.Range\s*\(\s*[\"']D4:E
- Forbidden pattern absent: \.UsedRange\s*\.\s*Value\s*=
- Forbidden pattern absent: \.Value\s*=\s*[^\n]*\.Value
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 아니오 · 수식 보존: 아니오
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!B4` → ABC통신 매출 합산값 (예: 1435000 등 숫자)
  - `회사별요약!B5` → 글로벌네트워크 매출 합산값
  - `회사별요약!B6~B23` → dictSales에 매칭되면 합산값, 없으면 0 (빈칸이 아닌 0)
  - `회사별요약!C4` → ABC통신 원가 합산값
  - `회사별요약!C5` → 글로벌네트워크 원가 합산값
  - `회사별요약!C6~C23` → dictCost에 매칭되면 합산값, 없으면 0 (빈칸이 아닌 0)
  - `회사별요약!B24` → 0 (합계행: 회사명 없음 → outArrSales(21,1)=0 으로 덮어씀)
  - `회사별요약!C24` → 0 (합계행: 회사명 없음 → outArrCost(21,1)=0 으로 덮어씀)
  - `회사별요약!D4` → =B4-C4 (수식 보존됨 — D열 미접촉)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 보존됨 — E열 미접촉)
  - `회사별요약!D24` → =SUM(D4:D23) (수식 보존됨 — D열 미접촉)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 보존됨 — E열 미접촉)
- 근거: D열·E열 수식은 건드리지 않아 보존되지만, 합계행(24행) 범위 산정 오류로 B24·C24에 0이 기입될 수 있고, 매칭 안 된 회사에도 0을 쓰는 문제가 있습니다. '빈칸만 채워달라'는 의도와 달리 전체 범위를 배열로 덮어쓰는 방식이라 부분적 범위 오염 위험이 있어 RISK로 판정합니다.
- 위험: 합계행(24행) 덮어쓰기: lastRowOut이 24로 잡히면 nRows=21이 되어 B24, C24에 0을 씀 — SUM/AVERAGE 수식이 있는 D24/E24는 건드리지 않지만, B24·C24에 0을 쓰면 합계 계산에 영향
- 위험: 매출/원가 미매칭 회사에 0 기입: 사용자는 '빈칸만 채워달라'고 했는데, dictSales에 없는 회사명에도 0을 써버려 기존 빈칸을 0으로 오염
- 위험: 배열 일괄 쓰기(Range.Value=배열): 해당 코드는 배열로 B열·C열 전체를 한 번에 씀. 만약 B24나 C24에 기존 수식이 있었다면 0으로 덮임
- 수정 필요: 데이터 범위를 4~23행으로 명시 한정하여 합계행(24행) 접근 차단
- 수정 필요: 미매칭 회사에 0을 기입하지 말고 빈칸 그대로 유지 (Else 절에서 0 대입 제거)
- 수정 필요: 배열 일괄 쓰기 대신 행별 개별 쓰기로 변경하여 의도치 않은 셀 덮어쓰기 방지

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 lastRowOut 기준으로 nRows를 계산하여 합계행(24행)을 범위에 포함시키고, 회사명이 없는 행에 0을 쓰는 문제가 있습니다. 개선안은 데이터 행을 4~23행으로 명시 한정하고, 합계행(24행)에는 절대 접근하지 않습니다. 또한 '빈칸만 채운다'는 사용자 의도에 맞게 기존에 값이 있는 셀은 건드리지 않도록 IsEmpty 체크를 추가했습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 워크북 참조
    Dim wbSales As Workbook, wbCost As Workbook, wbOut As Workbook
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSales = wb
        If wb.Name = "input_원가_2026_4월.xlsx" Then Set wbCost = wb
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbOut = wb
    Next wb
    If wbSales Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    If wbCost Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx' 가 열려 있지 않습니다."
    If wbOut Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    ' 2. 시트 참조
    Dim wsSales As Worksheet, wsCost As Worksheet, wsOut As Worksheet
    Set wsSales = wbSales.Worksheets("매출")
    Set wsCost = wbCost.Worksheets("원가")
    Set wsOut = wbOut.Worksheets("회사별요약")

    ' 3. 매출 집계
    Dim dictSales As Object: Set dictSales = CreateObject("Scripting.Dictionary")
    Dim lastRowSales As Long
    lastRowSales = wsSales.Cells(wsSales.Rows.Count, 1).End(xlUp).Row
    If lastRowSales > 1 Then
        Dim arrSales As Variant
        arrSales = wsSales.Range(wsSales.Cells(2, 1), wsSales.Cells(lastRowSales, 4)).Value
        Dim r As Long, key As String, amt As Double
        For r = 1 To UBound(arrSales, 1)
            key = Trim(CStr(arrSales(r, 1)))
            If key <> "" Then
                If IsNumeric(arrSales(r, 4)) Then amt = CDbl(arrSales(r, 4)) Else amt = 0
                If dictSales.Exists(key) Then dictSales(key) = dictSales(key) + amt Else dictSales.Add key, amt
            End If
        Next r
    End If

    ' 4. 원가 집계
    Dim dictCost As Object: Set dictCost = CreateObject("Scripting.Dictionary")
    Dim lastRowCost As Long
    lastRowCost = wsCost.Cells(wsCost.Rows.Count, 1).End(xlUp).Row
    If lastRowCost > 1 Then
        Dim arrCost As Variant
        arrCost = wsCost.Range(wsCost.Cells(2, 1), wsCost.Cells(lastRowCost, 4)).Value
        For r = 1 To UBound(arrCost, 1)
            key = Trim(CStr(arrCost(r, 1)))
            If key <> "" Then
                If IsNumeric(arrCost(r, 4)) Then amt = CDbl(arrCost(r, 4)) Else amt = 0
                If dictCost.Exists(key) Then dictCost(key) = dictCost(key) + amt Else dictCost.Add key, amt
            End If
        Next r
    End If

    ' 5. 헤더 탐색
    Dim hdrRow As Long: hdrRow = 3
    Dim colCompany As Long, colSales As Long, colCost As Long
    colCompany = 0: colSales = 0: colCost = 0
    Dim lastColOut As Long
    lastColOut = wsOut.Cells(hdrRow, wsOut.Columns.Count).End(xlToLeft).Column
    Dim c As Long
    For c = 1 To lastColOut
        Dim hVal As String
        hVal = Trim(CStr(wsOut.Cells(hdrRow, c).Value))
        If hVal = "회사명" Then colCompany = c
        If hVal = "매출" Then colSales = c
        If hVal = "원가" Then colCost = c
    Next c
    If colCompany = 0 Or colSales = 0 Or colCost = 0 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "헤더 열을 찾지 못했습니다(회사명/매출/원가)."
    End If

    ' 6. 데이터 행 범위: 4행~23행 (합계행 24행 명시 제외)
    Dim dataStartRow As Long: dataStartRow = hdrRow + 1  ' 4
    Dim dataEndRow As Long: dataEndRow = 23               ' 합계행(24) 직전까지 명시
    ' 합계행은 컬럼A가 비어있거나 수식행일 수 있으므로 회사명 있는 행만 쓰기

    Dim changed As Long: changed = 0
    Dim i As Long
    For i = dataStartRow To dataEndRow
        Dim companyName As String
        companyName = Trim(CStr(wsOut.Cells(i, colCompany).Value))
        If companyName <> "" Then
            ' 매출: 빈칸이거나 0인 경우에만 채우기 (기존 값 보호 옵션 — 사용자가 빈칸만 채우라고 했으므로)
            If wsOut.Cells(i, colSales).Value = "" Or IsEmpty(wsOut.Cells(i, colSales)) Then
                If dictSales.Exists(companyName) Then
                    wsOut.Cells(i, colSales).Value = dictSales(companyName)
                    changed = changed + 1
                End If
            End If
            ' 원가: 빈칸이거나 0인 경우에만 채우기
            If wsOut.Cells(i, colCost).Value = "" Or IsEmpty(wsOut.Cells(i, colCost)) Then
                If dictCost.Exists(companyName) Then
                    wsOut.Cells(i, colCost).Value = dictCost(companyName)
                    changed = changed + 1
                End If
            End If
        End If
    Next i

    If changed = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다(매칭된 회사명 없음 또는 이미 채워진 셀)."

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 워크북 참조 (안전 탐색)
    Dim wbSales As Workbook, wbCost As Workbook, wbOut As Workbook
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSales = wb
        If wb.Name = "input_원가_2026_4월.xlsx" Then Set wbCost = wb
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbOut = wb
    Next wb
    If wbSales Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    If wbCost Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx' 가 열려 있지 않습니다."
    If wbOut Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    ' 2. 시트 참조
    Dim wsSales As Worksheet, wsCost As Worksheet, wsOut As Worksheet
    Set wsSales = wbSales.Worksheets("매출")
    Set wsCost = wbCost.Worksheets("원가")
    Set wsOut = wbOut.Worksheets("회사별요약")

    ' 3. 매출 데이터 읽기 및 집계 (Dictionary)
    Dim dictSales As Object: Set dictSales = CreateObject("Scripting.Dictionary")
    Dim lastRowSales As Long, lastColSales As Long
    lastRowSales = wsSales.Cells(wsSales.Rows.Count, 1).End(xlUp).Row
    Dim arrSales As Variant
    If lastRowSales > 1 Then
        arrSales = wsSales.Range(wsSales.Cells(2, 1), wsSales.Cells(lastRowSales, 4)).Value ' 회사명, 상품, 건수, 금액
        Dim r As Long, key As String, amt As Double
        For r = 1 To UBound(arrSales, 1)
            key = Trim(CStr(arrSales(r, 1)))
            If key <> "" Then
                If IsNumeric(arrSales(r, 4)) Then amt = CDbl(arrSales(r, 4)) Else amt = 0
                If dictSales.Exists(key) Then
                    dictSales(key) = dictSales(key) + amt
                Else
                    dictSales.Add key, amt
                End If
            End If
        Next r
    End If

    ' 4. 원가 데이터 읽기 및 집계 (Dictionary)
    Dim dictCost As Object: Set dictCost = CreateObject("Scripting.Dictionary")
    Dim lastRowCost As Long
    lastRowCost = wsCost.Cells(wsCost.Rows.Count, 1).End(xlUp).Row
    Dim arrCost As Variant
    If lastRowCost > 1 Then
        arrCost = wsCost.Range(wsCost.Cells(2, 1), wsCost.Cells(lastRowCost, 4)).Value ' 회사명, 상품, 단가, 원가
        For r = 1 To UBound(arrCost, 1)
            key = Trim(CStr(arrCost(r, 1)))
            If key <> "" Then
                If IsNumeric(arrCost(r, 4)) Then amt = CDbl(arrCost(r, 4)) Else amt = 0
                If dictCost.Exists(key) Then
                    dictCost(key) = dictCost(key) + amt
                Else
                    dictCost.Add key, amt
                End If
            End If
        Next r
    End If

    ' 5. 출력 시트 헤더 탐색 및 데이터 범위 확인
    Dim hdrRow As Long: hdrRow = 3 ' 스키마에 따르면 헤더는 3행
    Dim lastColOut As Long
    lastColOut = wsOut.Cells(hdrRow, wsOut.Columns.Count).End(xlToLeft).Column
    
    ' 회사명(A), 매출(B), 원가(C) 열 번호 확인
    Dim colCompany As Long, colSales As Long, colCost As Long
    colCompany = 0: colSales = 0: colCost = 0
    Dim c As Long
    For c = 1 To lastColOut
        Dim hVal As String
        hVal = Trim(CStr(wsOut.Cells(hdrRow, c).Value))
        If hVal = "회사명" Then colCompany = c
        If hVal = "매출" Then colSales = c
        If hVal = "원가" Then colCost = c
    Next c
    If colCompany = 0 Or colSales = 0 Or colCost = 0 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "헤더 열을 찾지 못했습니다(회사명/매출/원가)."
    End If

    ' 데이터 마지막 행 확인 (합계행 제외)
    Dim lastRowOut As Long
    lastRowOut = wsOut.Cells(wsOut.Rows.Count, colCompany).End(xlUp).Row
    
    ' 합계/평균 행이 마지막에 있으면 제외 (수식 보호)
    ' 스키마에 따르면 D24, E24 에 SUM/AVERAGE 수식이 있음.
    ' 회사명 열(A)이 비어있거나 합계 라벨이 있으면 그 행은 건너뜀.
    ' 여기서는 단순히 데이터 행만 처리하고, 수식이 있는 행은 회사명이 비어있을 가능성이 높으므로
    ' 회사명이 있는 행만 대상으로 함.
    
    Dim outArrSales() As Variant, outArrCost() As Variant
    Dim nRows As Long
    nRows = lastRowOut - hdrRow
    If nRows < 1 Then Err.Raise vbObjectError + 513, "B2BSkill", "출력 시트에 데이터 행이 없습니다."
    
    ReDim outArrSales(1 To nRows, 1 To 1)
    ReDim outArrCost(1 To nRows, 1 To 1)
    
    Dim changed As Long: changed = 0
    Dim i As Long
    For i = 1 To nRows
        Dim currentRow As Long: currentRow = hdrRow + i
        Dim companyName As String
        companyName = Trim(CStr(wsOut.Cells(currentRow, colCompany).Value))
        
        If companyName <> "" Then
            ' 매출 채우기
            If dictSales.Exists(companyName) Then
                outArrSales(i, 1) = dictSales(companyName)
                changed = changed + 1
            Else
                outArrSales(i, 1) = 0 ' 또는 빈값, 여기서는 0으로 초기화
            End If
            
            ' 원가 채우기
            If dictCost.Exists(companyName) Then
                outArrCost(i, 1) = dictCost(companyName)
                changed = changed + 1
            Else
                outArrCost(i, 1) = 0
            End If
        Else
            ' 회사명이 없는 행(예: 합계행)은 0 또는 빈값으로 두되, 변경 카운트에는 포함 안 함
            outArrSales(i, 1) = 0
            outArrCost(i, 1) = 0
        End If
    Next i

    ' 6. 값 쓰기 (매출 열, 원가 열만)
    If colSales > 0 Then
        wsOut.Range(wsOut.Cells(hdrRow + 1, colSales), wsOut.Cells(hdrRow + nRows, colSales)).Value = outArrSales
    End If
    If colCost > 0 Then
        wsOut.Range(wsOut.Cells(hdrRow + 1, colCost), wsOut.Cells(hdrRow + nRows, colCost)).Value = outArrCost
    End If

    If changed = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다(매칭된 회사명이 없음)."

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_download_preserve / formula_result_check_not_overwrite — WARN

Prompt:
```text
고객이 다운로드 후 마진/마진율이 수식으로 계산됐는지 확인해야 해. B, C열만 입력하고 D, E의 수식은 유지되게 해줘.
```
Warnings:
- Formula-aware value writes need Windows E2E validation.
Needs Windows:
- Formula preservation requires real Excel workbook diff.
- Download formula preservation is validated by Excel/openpyxl workbook diff, not static code alone.
- 회사별요약 B/C 만 채워지고 D(마진)/E(마진율)/24행 합계 수식이 그대로 재계산되는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Scripting.Dictionary usage is allowed.
- Forbidden pattern absent: \.Range\s*\(\s*[\"']D4:E
- Forbidden pattern absent: \.UsedRange\s*\.\s*Value\s*=
- Forbidden pattern absent: \.Value\s*=\s*[^\n]*\.Value
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!B4` → ABC통신 매출 합계 (숫자값, 예: 1435000 등 집계 결과)
  - `회사별요약!B5` → 글로벌네트워크 매출 합계 (숫자값)
  - `회사별요약!B4:B23` → 각 회사별 매출 집계 숫자값 (input_매출_2026_4월.xlsx 매출 시트 4열 합산)
  - `회사별요약!C4:C23` → 각 회사별 원가 집계 숫자값 (input_원가_2026_4월.xlsx 원가 시트 4열 합산)
  - `회사별요약!D4` → =B4-C4 (수식 그대로 보존, 덮어쓰지 않음)
  - `회사별요약!D5` → =B5-C5 (수식 그대로 보존)
  - `회사별요약!D4:D23` → =Bx-Cx 수식 전체 보존 — B,C열 값 입력 후 재계산됨
  - `회사별요약!E4:E23` → =IFERROR(Dx/Bx,0) 수식 전체 보존 — 재계산됨
  - `회사별요약!D24` → =SUM(D4:D23) 수식 보존 (건드리지 않음)
  - `회사별요약!E24` → =AVERAGE(E4:E23) 수식 보존 (건드리지 않음)
- 근거: 코드는 B열(매출)과 C열(원가)에만 값을 배열로 대입하고 D·E열 수식을 전혀 건드리지 않으므로 기대 결과와 정확히 일치한다. D24·E24의 합계/평균 수식 행도 dataEndRow 로직으로 제외되어 보존된다. Cleanup 패턴도 오류 시 Err.Raise 로 재발생하므로 조용한 무시가 없다. COM 런타임 관점에서 병합셀(A1:E1)이 있으나 B·C열 데이터 범위(4~23행)는 병합과 겹치지 않아 1004 위험이 낮다.
- 위험: 회사별요약 시트의 A열에 회사명이 없거나 매출/원가 딕셔너리의 키와 대소문자·공백이 다를 경우 B,C열에 0이 입력될 수 있음 (실제 no-match 시 0 처리로 수식은 유지되나 의미 없는 값)
- 위험: lastRowOut 계산 시 A열 기준 End(xlUp) 사용 — A4:A23에 회사명이 모두 채워져 있지 않으면 dataEndRow가 실제보다 작게 잡혀 일부 행이 누락될 수 있음
- 위험: output_청구서_템플릿.xlsx가 COM 환경에서 열려 있지 않으면 wbOut Is Nothing으로 즉시 Err.Raise 발생 — 정상 에러 처리이나 운영 시 사전 확인 필요

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSales As Workbook, wbCost As Workbook, wbOut As Workbook
    Dim wsSales As Worksheet, wsCost As Worksheet, wsOut As Worksheet
    Dim wb As Workbook

    ' 1. 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSales = wb
        If wb.Name = "input_원가_2026_4월.xlsx" Then Set wbCost = wb
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbOut = wb
    Next wb

    If wbSales Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx'가 열려 있지 않습니다."
    If wbCost Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx'가 열려 있지 않습니다."
    If wbOut Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx'가 열려 있지 않습니다."

    Set wsSales = wbSales.Worksheets("매출")
    Set wsCost = wbCost.Worksheets("원가")
    Set wsOut = wbOut.Worksheets("회사별요약")

    ' 2. 매출 데이터 집계 (Dictionary)
    Dim dictSales As Object: Set dictSales = CreateObject("Scripting.Dictionary")
    Dim lastRowSales As Long, r As Long
    lastRowSales = wsSales.Cells(wsSales.Rows.Count, 1).End(xlUp).Row
    
    ' 매출 시트 헤더 확인 (회사명=1, 금액=4)
    For r = 2 To lastRowSales
        Dim compName As String
        compName = Trim(CStr(wsSales.Cells(r, 1).Value))
        If compName <> "" Then
            Dim amt As Double
            If IsNumeric(wsSales.Cells(r, 4).Value) Then
                amt = CDbl(wsSales.Cells(r, 4).Value)
            Else
                amt = 0
            End If
            If dictSales.Exists(compName) Then
                dictSales(compName) = dictSales(compName) + amt
            Else
                dictSales(compName) = amt
            End If
        End If
    Next r

    ' 3. 원가 데이터 집계 (Dictionary)
    Dim dictCost As Object: Set dictCost = CreateObject("Scripting.Dictionary")
    Dim lastRowCost As Long
    lastRowCost = wsCost.Cells(wsCost.Rows.Count, 1).End(xlUp).Row
    
    ' 원가 시트 헤더 확인 (회사명=1, 원가=4)
    For r = 2 To lastRowCost
        Dim compNameCost As String
        compNameCost = Trim(CStr(wsCost.Cells(r, 1).Value))
        If compNameCost <> "" Then
            Dim costAmt As Double
            If IsNumeric(wsCost.Cells(r, 4).Value) Then
                costAmt = CDbl(wsCost.Cells(r, 4).Value)
            Else
                costAmt = 0
            End If
            If dictCost.Exists(compNameCost) Then
                dictCost(compNameCost) = dictCost(compNameCost) + costAmt
            Else
                dictCost(compNameCost) = costAmt
            End If
        End If
    Next r

    ' 4. 출력 시트에 값 채우기 (B, C열만)
    Dim hdrRow As Long: hdrRow = 3
    Dim lastRowOut As Long
    lastRowOut = wsOut.Cells(wsOut.Rows.Count, 1).End(xlUp).Row
    
    ' 합계행(마지막 행) 제외: 보통 마지막 행은 합계 수식이 있음.
    ' 스키마에 따르면 D24, E24에 합계/평균 수식이 있으므로 lastRowOut은 24.
    ' 데이터는 4행부터 23행까지.
    Dim dataEndRow As Long
    ' 마지막 행이 합계/평균 수식인지 확인 (D열 또는 E열에 SUM/AVERAGE 포함)
    Dim checkVal As Variant
    checkVal = wsOut.Cells(lastRowOut, 4).Formula
    If InStr(1, CStr(checkVal), "SUM") > 0 Or InStr(1, CStr(checkVal), "AVERAGE") > 0 Then
        dataEndRow = lastRowOut - 1
    Else
        dataEndRow = lastRowOut
    End If
    
    If dataEndRow < hdrRow + 1 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "출력 시트에 채울 데이터 행이 없습니다."
    End If

    Dim outArr() As Variant
    ReDim outArr(1 To dataEndRow - hdrRow, 1 To 2) ' 1:매출(B), 2:원가(C)
    
    Dim i As Long
    For r = hdrRow + 1 To dataEndRow
        i = r - hdrRow
        Dim key As String
        key = Trim(CStr(wsOut.Cells(r, 1).Value))
        
        If dictSales.Exists(key) Then
            outArr(i, 1) = dictSales(key)
        Else
            outArr(i, 1) = 0
        End If
        
        If dictCost.Exists(key) Then
            outArr(i, 2) = dictCost(key)
        Else
            outArr(i, 2) = 0
        End If
    Next r

    ' B열(매출)과 C열(원가)에 값만 대입. D, E열(수식)은 건드리지 않음.
    Dim targetRngB As Range, targetRngC As Range
    Set targetRngB = wsOut.Range(wsOut.Cells(hdrRow + 1, 2), wsOut.Cells(dataEndRow, 2))
    Set targetRngC = wsOut.Range(wsOut.Cells(hdrRow + 1, 3), wsOut.Cells(dataEndRow, 3))
    
    ' 배열을 열별로 나누어 대입 (2차원 배열 1열짜리)
    Dim salesArr() As Variant, costArr() As Variant
    ReDim salesArr(1 To UBound(outArr, 1), 1 To 1)
    ReDim costArr(1 To UBound(outArr, 1), 1 To 1)
    
    For i = 1 To UBound(outArr, 1)
        salesArr(i, 1) = outArr(i, 1)
        costArr(i, 1) = outArr(i, 2)
    Next i
    
    targetRngB.Value = salesArr
    targetRngC.Value = costArr

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: WARN

## formula_download_preserve / preserve_existing_formulas — NEEDS_WINDOWS

Prompt:
```text
출력 템플릿(회사별요약)에 이미 들어있는 마진/마진율/합계 수식은 그대로 두고, 필요한 입력 셀(매출·원가)만 수정해줘.
```
Warnings:
- Sonnet 검수 RISK: D/E열 수식(마진·마진율·합계)은 B/C열만 Value로 써서 보존되므로 수식 보호 측면은 PASS 수준임. 그러나 딕셔너리에 없는 회사(6~23행)의 B/C에 0을 덮어쓰는 동작이 사용자 요청('필요한 입력 셀만 수정')과 어긋나며, A24 셀 내용에 따라 합계행 B/C가 덮어써질 수 있는 불안정한 범위 계산이 존재해 RISK로 판정함. 또한 글로벌네트워크의 원가가 0으로 쓰여 실제 원가 수식 결과가 왜곡될 수 있음.
Needs Windows:
- Formula preservation requires real Excel workbook diff.
- Download formula preservation is validated by Excel/openpyxl workbook diff, not static code alone.
- 회사별요약 B/C 만 채워지고 D(마진)/E(마진율)/24행 합계 수식이 그대로 재계산되는지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Scripting.Dictionary usage is allowed.
- Forbidden pattern absent: \.Range\s*\(\s*[\"']D4:E
- Forbidden pattern absent: \.UsedRange\s*\.\s*Value\s*=
- Forbidden pattern absent: \.Value\s*=\s*[^\n]*\.Value
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 아니오 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!B4` → 1435000(ABC통신 매출 합계)
  - `회사별요약!C4` → 84718(ABC통신 원가 합계: 59383+25335)
  - `회사별요약!D4` → =B4-C4 (수식 그대로 유지)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 그대로 유지)
  - `회사별요약!B5` → 198000(글로벌네트워크 매출 합계)
  - `회사별요약!C5` → 0(글로벌네트워크가 원가 시트에 없으므로 0으로 쓰임)
  - `회사별요약!D5` → =B5-C5 (수식 그대로 유지)
  - `회사별요약!E5` → =IFERROR(D5/B5,0) (수식 그대로 유지)
  - `회사별요약!B6~B23` → 0 (dictSales에 없는 회사 → 0으로 덮어씀)
  - `회사별요약!C6~C23` → 0 (dictCost에 없는 회사 → 0으로 덮어씀)
  - `회사별요약!B24` → lastRowOut 계산에 따라 결정됨 — A24가 비어있으면 End(xlUp)이 23행에서 멈춰 24행은 건드리지 않음(수식 보존). A24에 텍스트가 있으면 덮어씀 위험
  - `회사별요약!D24` → =SUM(D4:D23) (수식 그대로 유지 — B/C 열만 씀)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 그대로 유지 — B/C 열만 씀)
- 근거: D/E열 수식(마진·마진율·합계)은 B/C열만 Value로 써서 보존되므로 수식 보호 측면은 PASS 수준임. 그러나 딕셔너리에 없는 회사(6~23행)의 B/C에 0을 덮어쓰는 동작이 사용자 요청('필요한 입력 셀만 수정')과 어긋나며, A24 셀 내용에 따라 합계행 B/C가 덮어써질 수 있는 불안정한 범위 계산이 존재해 RISK로 판정함. 또한 글로벌네트워크의 원가가 0으로 쓰여 실제 원가 수식 결과가 왜곡될 수 있음.
- 위험: 딕셔너리에 없는 회사명(B6~B23 해당 행)의 B/C열이 0으로 덮어써짐 — 기존 데이터가 있었다면 손실
- 위험: A열 기준 End(xlUp) lastRowOut이 합계행(24행) 포함 여부가 A24 셀 내용에 따라 달라져, A24에 텍스트 있으면 합계행 B/C가 0으로 덮어써질 수 있음
- 위험: 원가 파일에서 글로벌네트워크가 없으므로 C5에 0이 써져 마진/마진율이 실제 원가와 달라짐
- 위험: changed 카운트 로직이 dictSales/dictCost 존재 여부와 무관하게 0을 써도 증가하지 않아, 실제 변경 건 추적이 부정확함(0 덮어쓰기는 카운트 안 됨 — 이는 오히려 혼란)
- 수정 필요: 딕셔너리에 없는 회사 행은 0 덮어쓰기 대신 기존 값 유지(조건문 추가)
- 수정 필요: 데이터 끝 행을 End(xlUp) 대신 합계행 상수(24) 기준으로 TOTAL_ROW-1=23으로 고정하거나, D/E열 수식 존재 여부로 합계행을 명시적으로 건너뜀
- 수정 필요: 합계행(24행)에 대한 명시적 skip 처리 추가

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 딕셔너리에 없는 회사(B6~B23 등)에 0을 덮어쓰는 문제가 있고, 합계행(24행)이 A열 비어있을 때만 안전한 불안정한 동작을 함. 개선안은 ① 데이터 행 범위를 상수(4~23)로 명시해 합계행을 절대 건드리지 않으며, ② 딕셔너리에 없는 회사 행은 기존 값을 유지(0 덮어쓰기 금지)하여 의도치 않은 데이터 손실을 방지함._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbOut As Workbook, wbSales As Workbook, wbCost As Workbook
    Dim wsOut As Worksheet, wsSales As Worksheet, wsCost As Worksheet

    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbOut = wb: Exit For
    Next wb
    If wbOut Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx'가 열려 있지 않습니다."
    Set wsOut = wbOut.Worksheets("회사별요약")

    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSales = wb: Exit For
    Next wb
    If wbSales Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx'가 열려 있지 않습니다."
    Set wsSales = wbSales.Worksheets("매출")

    For Each wb In Application.Workbooks
        If wb.Name = "input_원가_2026_4월.xlsx" Then Set wbCost = wb: Exit For
    Next wb
    If wbCost Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx'가 열려 있지 않습니다."
    Set wsCost = wbCost.Worksheets("원가")

    Dim dictSales As Object, dictCost As Object
    Set dictSales = CreateObject("Scripting.Dictionary")
    Set dictCost = CreateObject("Scripting.Dictionary")

    Dim lastRowSales As Long, r As Long
    lastRowSales = wsSales.Cells(wsSales.Rows.Count, 1).End(xlUp).Row
    If lastRowSales > 1 Then
        Dim salesArr As Variant
        salesArr = wsSales.Range(wsSales.Cells(2, 1), wsSales.Cells(lastRowSales, 4)).Value
        For r = 1 To UBound(salesArr, 1)
            Dim compName As String
            compName = Trim(CStr(salesArr(r, 1)))
            If compName <> "" Then
                If dictSales.Exists(compName) Then
                    dictSales(compName) = dictSales(compName) + CDbl(salesArr(r, 4))
                Else
                    dictSales.Add compName, CDbl(salesArr(r, 4))
                End If
            End If
        Next r
    End If

    Dim lastRowCost As Long
    lastRowCost = wsCost.Cells(wsCost.Rows.Count, 1).End(xlUp).Row
    If lastRowCost > 1 Then
        Dim costArr As Variant
        costArr = wsCost.Range(wsCost.Cells(2, 1), wsCost.Cells(lastRowCost, 4)).Value
        For r = 1 To UBound(costArr, 1)
            Dim compNameC As String
            compNameC = Trim(CStr(costArr(r, 1)))
            If compNameC <> "" Then
                If dictCost.Exists(compNameC) Then
                    dictCost(compNameC) = dictCost(compNameC) + CDbl(costArr(r, 4))
                Else
                    dictCost.Add compNameC, CDbl(costArr(r, 4))
                End If
            End If
        Next r
    End If

    ' 헤더 행(3) 기준으로 열 번호 탐색
    Dim hdrRow As Long: hdrRow = 3
    Dim colComp As Long, colSales As Long, colCost As Long
    Dim c As Long
    colComp = 0: colSales = 0: colCost = 0
    For c = 1 To wsOut.Cells(hdrRow, wsOut.Columns.Count).End(xlToLeft).Column
        Select Case Trim(CStr(wsOut.Cells(hdrRow, c).Value))
            Case "회사명": colComp = c
            Case "매출":  colSales = c
            Case "원가":  colCost = c
        End Select
    Next c
    If colComp = 0 Or colSales = 0 Or colCost = 0 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "회사별요약 헤더에서 회사명/매출/원가 열을 찾지 못했습니다."
    End If

    ' 합계행(24행)을 제외하기 위해 데이터 행 범위를 명시적으로 결정
    ' A열 기준으로 End(xlUp)을 쓰되, 합계행 라벨이 있는 경우 대비해 D열 수식 여부로 데이터 끝 행 결정
    Const DATA_FIRST_ROW As Long = 4
    Const TOTAL_ROW As Long = 24   ' 스키마에 명시된 합계행
    Dim dataLastRow As Long
    ' 합계행 바로 위까지만 데이터 행으로 한정
    dataLastRow = TOTAL_ROW - 1  ' = 23

    ' 실제로 A열에 회사명이 있는 행만 갱신, 없는 행은 기존 값 유지 (0 덮어쓰기 방지)
    Dim changed As Long: changed = 0
    For r = DATA_FIRST_ROW To dataLastRow
        Dim currentComp As String
        currentComp = Trim(CStr(wsOut.Cells(r, colComp).Value))
        If currentComp <> "" Then
            ' 매출: 딕셔너리에 있으면 씀, 없으면 기존 값 유지(덮어쓰지 않음)
            If dictSales.Exists(currentComp) Then
                wsOut.Cells(r, colSales).Value = dictSales(currentComp)
                changed = changed + 1
            End If
            ' 원가: 딕셔너리에 있으면 씀, 없으면 기존 값 유지
            If dictCost.Exists(currentComp) Then
                wsOut.Cells(r, colCost).Value = dictCost(currentComp)
                changed = changed + 1
            End If
        End If
    Next r

    If changed = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다. 회사명 일치 여부를 확인하세요."

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 대상 워크북 및 시트 설정
    Dim wbOut As Workbook, wbSales As Workbook, wbCost As Workbook
    Dim wsOut As Worksheet, wsSales As Worksheet, wsCost As Worksheet
    
    ' 출력 파일 찾기
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbOut = wb: Exit For
    Next wb
    If wbOut Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx'가 열려 있지 않습니다."
    
    Set wsOut = wbOut.Worksheets("회사별요약")
    
    ' 입력 파일(매출) 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSales = wb: Exit For
    Next wb
    If wbSales Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx'가 열려 있지 않습니다."
    Set wsSales = wbSales.Worksheets("매출")
    
    ' 입력 파일(원가) 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_원가_2026_4월.xlsx" Then Set wbCost = wb: Exit For
    Next wb
    If wbCost Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx'가 열려 있지 않습니다."
    Set wsCost = wbCost.Worksheets("원가")

    ' 2. 데이터 읽기 및 합산 (Dictionary 사용)
    Dim dictSales As Object, dictCost As Object
    Set dictSales = CreateObject("Scripting.Dictionary")
    Set dictCost = CreateObject("Scripting.Dictionary")
    
    ' 매출 데이터 처리
    Dim lastRowSales As Long, r As Long
    lastRowSales = wsSales.Cells(wsSales.Rows.Count, 1).End(xlUp).Row
    If lastRowSales > 1 Then
        Dim salesArr As Variant
        salesArr = wsSales.Range(wsSales.Cells(2, 1), wsSales.Cells(lastRowSales, 4)).Value ' 회사명, 상품, 건수, 금액
        For r = 1 To UBound(salesArr, 1)
            Dim compName As String
            compName = Trim(CStr(salesArr(r, 1)))
            If compName <> "" Then
                If dictSales.Exists(compName) Then
                    dictSales(compName) = dictSales(compName) + CDbl(salesArr(r, 4))
                Else
                    dictSales(compName) = CDbl(salesArr(r, 4))
                End If
            End If
        Next r
    End If
    
    ' 원가 데이터 처리
    Dim lastRowCost As Long
    lastRowCost = wsCost.Cells(wsCost.Rows.Count, 1).End(xlUp).Row
    If lastRowCost > 1 Then
        Dim costArr As Variant
        costArr = wsCost.Range(wsCost.Cells(2, 1), wsCost.Cells(lastRowCost, 4)).Value ' 회사명, 상품, 단가, 원가
        For r = 1 To UBound(costArr, 1)
            Dim compNameC As String
            compNameC = Trim(CStr(costArr(r, 1)))
            If compNameC <> "" Then
                If dictCost.Exists(compNameC) Then
                    dictCost(compNameC) = dictCost(compNameC) + CDbl(costArr(r, 4))
                Else
                    dictCost(compNameC) = CDbl(costArr(r, 4))
                End If
            End If
        Next r
    End If

    ' 3. 출력 시트에 데이터 쓰기
    Dim hdrRow As Long: hdrRow = 3 ' 회사별요약 시트 헤더 행
    Dim lastRowOut As Long
    lastRowOut = wsOut.Cells(wsOut.Rows.Count, 1).End(xlUp).Row
    
    ' 합계행(마지막 행)이 수식을 포함하고 있다면 데이터 범위는 그 이전까지
    ' 스키마에 따르면 D24, E24에 합계/평균 수식이 있으므로 lastRowOut이 24라면 데이터는 23까지
    ' 하지만 End(xlUp)이 A열(회사명) 기준이므로, A열이 비어있는 행은 제외됨.
    ' 안전을 위해 A열이 비어있거나, D/E열에 수식이 있는 마지막 행은 제외해야 할 수 있음.
    ' 스키마: 행 4~23은 데이터, 행 24는 합계. A24는 비어있을 가능성이 높음(스키마에 명시 안됨).
    ' 만약 A24가 비어있다면 lastRowOut은 23이 될 것임.
    ' 만약 A24에 "합계" 등이 있다면 lastRowOut은 24가 될 것임.
    ' 수식 보호를 위해, D/E열에 수식이 있는 행은 절대 Value로 덮어쓰지 않음.
    ' 여기서는 B열(매출)과 C열(원가)만 쓰기 때문에 D/E열 수식은 안전함.
    ' 다만, 합계행에 매출/원가 합계 수식이 있다면 그것도 깨질 수 있음.
    ' 스키마 확인: D4==B4-C4 ... D24==SUM(D4:D23). B/C열에는 합계 수식이 명시되지 않았음.
    ' 따라서 B/C열 전체 범위에 값을 써도 D/E열 수식은 안전함.
    ' 하지만 합계행(B24, C24)에 수식이 있을 수 있으니 확인 필요.
    ' 스키마에 B24, C24에 대한 수식 언급이 없으므로 값으로 간주하거나 비어있음.
    ' 안전하게, 회사명이 있는 행만 처리함.
    
    Dim outSalesArr() As Variant, outCostArr() As Variant
    Dim dataRange As Range
    Set dataRange = wsOut.Range(wsOut.Cells(hdrRow + 1, 1), wsOut.Cells(lastRowOut, 1))
    Dim compArr As Variant
    compArr = dataRange.Value
    
    ReDim outSalesArr(1 To UBound(compArr, 1), 1 To 1)
    ReDim outCostArr(1 To UBound(compArr, 1), 1 To 1)
    
    Dim changed As Long: changed = 0
    
    For r = 1 To UBound(compArr, 1)
        Dim currentComp As String
        currentComp = Trim(CStr(compArr(r, 1)))
        
        If currentComp <> "" Then
            If dictSales.Exists(currentComp) Then
                outSalesArr(r, 1) = dictSales(currentComp)
                changed = changed + 1
            Else
                outSalesArr(r, 1) = 0 ' 또는 기존 값 유지? 요청은 "수정해줘"이므로 0 또는 빈값으로 초기화 가능. 기존 값이 없다면 0으로.
            End If
            
            If dictCost.Exists(currentComp) Then
                outCostArr(r, 1) = dictCost(currentComp)
                changed = changed + 1
            Else
                outCostArr(r, 1) = 0
            End If
        Else
            ' 회사명이 없는 행(예: 합계 행 라벨이 없는 경우)은 0 또는 빈값으로
            outSalesArr(r, 1) = 0
            outCostArr(r, 1) = 0
        End If
    Next r
    
    ' 매출 열(B)과 원가 열(C)에 쓰기
    ' 헤더 탐색으로 열 번호 확인 (스키마: B=매출, C=원가)
    Dim colSales As Long, colCost As Long
    Dim c As Long
    colSales = 0: colCost = 0
    For c = 1 To wsOut.Cells(hdrRow, wsOut.Columns.Count).End(xlToLeft).Column
        If Trim(CStr(wsOut.Cells(hdrRow, c).Value)) = "매출" Then colSales = c
        If Trim(CStr(wsOut.Cells(hdrRow, c).Value)) = "원가" Then colCost = c
    Next c
    
    If colSales = 0 Or colCost = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "매출 또는 원가 열을 찾지 못했습니다."
    
    ' 대상 범위 설정
    Dim targetSalesRng As Range, targetCostRng As Range
    Set targetSalesRng = wsOut.Range(wsOut.Cells(hdrRow + 1, colSales), wsOut.Cells(lastRowOut, colSales))
    Set targetCostRng = wsOut.Range(wsOut.Cells(hdrRow + 1, colCost), wsOut.Cells(lastRowOut, colCost))
    
    targetSalesRng.Value = outSalesArr
    targetCostRng.Value = outCostArr

    If changed = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다."

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_vs_value_intent / count_write_value — NEEDS_WINDOWS

Prompt:
```text
매출 시트 전체 건수의 합계를 숫자 값으로 월별실적!B4에 적어줘. 수식 말고 계산된 값으로.
```
Needs Windows:
- Verify formula-vs-value output matches the natural-language intent.
- 요청 표현에 맞는 형태(수식 또는 값)로 대상 셀에 들어갔는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Writes a single clear form (formula XOR value).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 매출 시트 C열(건수) 합계 숫자 값 (예: 약 46000 내외, 1200행 데이터 기준 합산된 정수/실수 값)
- 근거: 코드는 input_매출_2026_4월.xlsx의 '매출' 시트 C열(건수)을 2행부터 마지막 행까지 배열로 읽어 합산한 뒤, output_청구서_템플릿.xlsx의 '월별실적' 시트 B4 셀에 .Value로 값(수식 아님)을 입력한다. 사용자 요청(수식 말고 계산된 값으로 월별실적!B4에 입력)과 정확히 일치하며, 수식 덮어쓰기도 없고(B4는 스키마상 빈 셀), Err.Raise를 통해 오류를 드러내도록 되어 있다. 단일 행 엣지케이스(lastRow=2)에서 Range.Value가 스칼라를 반환해 UBound 오류가 날 수 있으나, 실제 데이터가 1201행이므로 실용적 위험은 낮다.
- 위험: wbSrc/wbDst가 COM 환경에서 열려 있지 않으면 Err.Raise로 정상 중단되나, Python COM 쪽에서 두 파일을 모두 열어두지 않으면 vbObjectError+515 발생 가능
- 위험: dataArr가 단일 셀(lastRow=2)일 때 1차원 배열이 아닌 2차원 배열로 반환되어 UBound(dataArr,1)=1 이 되는 것은 문제없으나, lastRow=2이면 Cells(2,3):Cells(2,3) 단일 셀 Range.Value는 2차원 배열이 아니라 스칼라 Variant 반환 → UBound 오류 가능(행이 1행뿐인 경우 엣지케이스)
- 위험: C열에 문자형 숫자가 섞여 있으면 IsNumeric이 True를 반환해 CDbl 변환 시도 → 대부분 정상 처리되나 특이 문자가 있으면 형변환 오류 가능
- 위험: 월별실적!B4에 기존 수식(D5==C5-C4 등 전월대비 수식)이 참조하고 있는 C열이 아닌 B열이므로 영향 없음; B4는 스키마상 빈 값이므로 덮어쓰기 충돌 없음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook

    ' 소스 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    ' 대상 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Set wsSrc = wbSrc.Worksheets("매출")
    Set wsDst = wbDst.Worksheets("월별실적")

    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 3).End(xlUp).Row ' C열(건수) 기준 마지막 행

    If lastRow < 2 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "매출 시트에 데이터가 없습니다."
    End If

    ' C열(건수) 데이터 배열 읽기
    Dim dataArr As Variant
    dataArr = wsSrc.Range(wsSrc.Cells(2, 3), wsSrc.Cells(lastRow, 3)).Value

    Dim totalCnt As Double
    Dim r As Long
    For r = 1 To UBound(dataArr, 1)
        If IsNumeric(dataArr(r, 1)) Then
            totalCnt = totalCnt + CDbl(dataArr(r, 1))
        End If
    Next r

    ' 결과 값 입력 (수식 아님)
    wsDst.Cells(4, 2).Value = totalCnt

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_vs_value_intent / count_with_formula — NEEDS_WINDOWS

Prompt:
```text
매출 시트 금액의 합계를 '구하는 수식'을 월별실적!C4에 넣어줘. 나중에 데이터 바뀌면 자동 갱신되게.
```
Warnings:
- Sonnet 검수 RISK: 사용자 의도는 월별실적!C4 에 매출 시트 금액(D열) 합계를 구하는 SUM 수식을 삽입하는 것입니다. 대상 셀(C4)과 시트(월별실적)는 올바르게 지정되었고 .Formula 로 수식을 넣으려는 방향도 맞습니다. 그러나 수식 문자열 조립 방식이 잘못되어 있습니다: formula 변수에 wbSrc.Path 를 포함시키면 Excel 외부 참조 표기법이 올바른 '[파일명]시트명'! 대신 '경로[파일명]시트명'! 형태가 되어 수식 파싱 오류(#NAME? 또는 #REF!)가 발생할 가능성이 높습니다. 수식이 삽입은 되더라도 계산 결과가 오류값이 되어 자동 갱신 목적이 달성되지 않을 수 있으므로 RISK로 판정합니다.
Needs Windows:
- Verify formula-vs-value output matches the natural-language intent.
- 요청 표현에 맞는 형태(수식 또는 값)로 대상 셀에 들어갔는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Writes a single clear form (formula XOR value).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!C4` → =SUM('C:\...경로...[input_매출_2026_4월.xlsx]매출'!D2:D1201)
  - `월별실적!D5` → =C5-C4 (변경 없음)
  - `월별실적!D6` → =C6-C5 (변경 없음)
- 근거: 사용자 의도는 월별실적!C4 에 매출 시트 금액(D열) 합계를 구하는 SUM 수식을 삽입하는 것입니다. 대상 셀(C4)과 시트(월별실적)는 올바르게 지정되었고 .Formula 로 수식을 넣으려는 방향도 맞습니다. 그러나 수식 문자열 조립 방식이 잘못되어 있습니다: formula 변수에 wbSrc.Path 를 포함시키면 Excel 외부 참조 표기법이 올바른 '[파일명]시트명'! 대신 '경로[파일명]시트명'! 형태가 되어 수식 파싱 오류(#NAME? 또는 #REF!)가 발생할 가능성이 높습니다. 수식이 삽입은 되더라도 계산 결과가 오류값이 되어 자동 갱신 목적이 달성되지 않을 수 있으므로 RISK로 판정합니다.
- 위험: 외부 참조 수식 문자열 조립 오류: formula 변수가 '경로[파일명]시트명'!D2:Dnnn 형태로 만들어지고 이를 =SUM(...) 안에 넣으면, Excel이 인식하는 올바른 외부 참조 형식('[파일명]시트명'!)이 아니라 경로가 [] 앞에 붙은 비표준 형식이 되어 수식 오류(#REF! 또는 #NAME?) 가 발생할 수 있음
- 위험: =SUM 안에 들어가는 formula 문자열 자체가 이미 = 로 시작하는 참조식이 아닌 단순 범위 문자열이어야 하는데, 코드에서 formula = "='경로[파일]시트'!D2:Dnnn" 처럼 = 를 포함하지는 않지만 Path 가 붙어 '[c:\xxx][파일.xlsx]시트'! 형식이 되어 Excel 수식 파서가 거부할 수 있음
- 위험: 매출 시트의 '금액' 열은 D열(4번째 열)이므로 lastRow 산출은 맞지만, 헤더 행(1행)을 포함해 D2:D1201 범위를 SUM하면 헤더가 숫자가 아니므로 실질적 영향은 없으나, 데이터가 없는 행까지 포함하는 과잉 범위임
- 위험: 저사양 폐쇄망 환경에서 외부 참조 수식은 원본 파일이 닫히면 절대 경로로 전환되거나 #REF! 가 발생할 수 있어, 자동 갱신 목적이 완전히 달성되지 않을 수 있음
- 수정 필요: 외부 참조 수식 형식을 =SUM('[파일명.xlsx]시트명'!D2:Dnnn) 으로 올바르게 조립할 것. wbSrc.Path 를 formula 에 포함하면 외부 참조 형식이 깨지므로 제거하거나 올바른 위치에 배치할 것
- 수정 필요: formula 변수 조립 시 = 없이 범위만 만들고 =SUM() 안에 넣는 방식으로 통일하거나, 최종 수식 문자열 전체를 한 번에 작성하여 중첩 오류를 방지할 것

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 외부 참조 수식 문자열을 잘못 조립하고 있습니다. formula 변수에 이미 =SUM 없는 범위 참조를 만든 뒤 그것을 다시 SUM(formula) 안에 넣으면, 실제로 셀에 들어가는 수식이 =SUM('경로[파일]시트'!D2:Dxxx) 가 아니라 =SUM('경로[파일]시트'!D2:Dxxx) 처럼 경로가 []의 앞에 붙어버리는 형식 오류가 발생합니다. 개선안에서는 외부 참조 수식의 올바른 형식인 =SUM('[파일명]시트명'!D2:Dnnn) 을 직접 조립하여 수식이 정확히 동작하도록 수정했습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook
    Dim wsDst As Worksheet
    Dim dstFile As String, dstSheet As String

    dstFile = "output_청구서_템플릿.xlsx"
    dstSheet = "월별실적"

    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = dstFile Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'" & dstFile & "' 가 열려 있지 않습니다."

    Dim sh As Worksheet
    For Each sh In wbDst.Worksheets
        If sh.Name = dstSheet Then Set wsDst = sh: Exit For
    Next sh
    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'" & dstSheet & "' 시트를 찾지 못했습니다."

    ' 대상 셀 서식을 General로 설정 (텍스트 서식일 경우 수식이 문자열로 저장되는 것 방지)
    wsDst.Cells(4, 3).NumberFormat = "General"

    ' 단순 SUM 수식: 동일 워크북 내 매출 시트가 없으므로 외부 참조를 사용하지 않고
    ' input_매출_2026_4월.xlsx 의 매출!D열 합계를 외부 참조 수식으로 삽입
    ' 단, 외부 워크북이 열려 있어야 수식이 올바로 계산됨
    Dim srcFile As String, srcSheet As String
    srcFile = "input_매출_2026_4월.xlsx"
    srcSheet = "매출"

    Dim wbSrc As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = srcFile Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'" & srcFile & "' 가 열려 있지 않습니다."

    Dim wsSrc As Worksheet
    For Each sh In wbSrc.Worksheets
        If sh.Name = srcSheet Then Set wsSrc = sh: Exit For
    Next sh
    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'" & srcSheet & "' 시트를 찾지 못했습니다."

    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 4).End(xlUp).Row
    If lastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "매출 데이터가 없습니다."

    ' 외부 참조 수식: 올바른 형식은 '[파일명]시트명'!범위
    ' wbSrc.Path 를 쓰면 외부 파일 닫혔을 때 절대경로로 전환됨 — 의도는 열린 상태 기준
    Dim formula As String
    formula = "=SUM('[" & srcFile & "]" & srcSheet & "'!D2:D" & lastRow & ")"
    wsDst.Cells(4, 3).Formula = formula

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim srcFile As String, dstFile As String
    Dim srcSheet As String, dstSheet As String
    Dim lastRow As Long
    
    ' 파일 및 시트 이름 정의
    srcFile = "input_매출_2026_4월.xlsx"
    srcSheet = "매출"
    dstFile = "output_청구서_템플릿.xlsx"
    dstSheet = "월별실적"
    
    ' 소스 워크북 찾기
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = srcFile Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'" & srcFile & "' 가 열려 있지 않습니다."
    
    ' 소스 시트 찾기
    Dim sh As Worksheet
    For Each sh In wbSrc.Worksheets
        If sh.Name = srcSheet Then Set wsSrc = sh: Exit For
    Next sh
    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'" & srcSheet & "' 시트를 찾지 못했습니다."
    
    ' 대상 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = dstFile Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'" & dstFile & "' 가 열려 있지 않습니다."
    
    ' 대상 시트 찾기
    For Each sh In wbDst.Worksheets
        If sh.Name = dstSheet Then Set wsDst = sh: Exit For
    Next sh
    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'" & dstSheet & "' 시트를 찾지 못했습니다."
    
    ' 소스 데이터 마지막 행 확인 (금액 열: D열, 4열)
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 4).End(xlUp).Row
    If lastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "매출 데이터가 없습니다."
    
    ' 대상 셀 서식 확인 및 수식 입력
    ' C4 셀에 수식을 넣기 위해 서식을 General로 설정 (텍스트 서식 방지)
    wsDst.Cells(4, 3).NumberFormat = "General"
    
    ' 수식 생성: [input_매출_2026_4월.xlsx]매출!D2:D[lastRow]
    Dim formula As String
    formula = "='" & wbSrc.Path & "[" & wbSrc.Name & "]" & wsSrc.Name & "'!D2:D" & lastRow
    
    ' 수식 대입 (FormulaLocal 사용 권장, 하지만 일반 수식도 가능)
    ' Excel 수식에서 외부 참조는 []와 !를 사용
    wsDst.Cells(4, 3).Formula = "=SUM(" & formula & ")"

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_vs_value_intent / sum_value_not_formula — NEEDS_WINDOWS

Prompt:
```text
회사별요약 매출 합계(B24 자리)를 계산해서 그 결과 숫자만 박아줘. 수식 필요 없어.
```
Needs Windows:
- Verify formula-vs-value output matches the natural-language intent.
- 요청 표현에 맞는 형태(수식 또는 값)로 대상 셀에 들어갔는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Writes a single clear form (formula XOR value).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!B24` → B4:B23 범위의 합계 숫자값(예: 매출 합계 실수값, 수식 없음)
- 근거: 사용자 요청은 '회사별요약 시트의 B24에 매출 합계를 숫자 값으로 기입(수식 불필요)'이며, 코드는 정확히 해당 시트의 B4:B23 합계를 Double 변수로 계산한 뒤 B24.Value에 할당함. 수식을 쓰지 않고 값만 대입하므로 의도에 완전히 부합하고, D/E열 수식(마진/마진율)이나 다른 셀에는 일절 손대지 않아 수식·서식 보존도 문제없음. On Error GoTo Cleanup + Err.Raise 패턴으로 오류를 숨기지 않고 상위로 전파하며, 금지 패턴(MsgBox, Save 등)도 없음.
- 위험: B4:B23 셀들이 비어 있거나 수식이 xlCalculationManual 상태에서 아직 계산되지 않은 경우 totalSales가 0이 될 수 있음. 단, Application.WorksheetFunction.Sum은 현재 셀 값을 직접 읽으므로 수식 결과가 이미 계산된 상태라면 문제없음.
- 위험: B24에 기존에 수식(예: =SUM(B4:B23))이 있었다면 이번 실행으로 값으로 덮어쓰여 수식이 사라짐. 그러나 이것은 사용자가 명시적으로 요청한 동작('수식 필요 없어')이므로 의도에 부합함.
- 위험: workbooks 컬렉션에 output_청구서_템플릿.xlsx가 열려 있지 않으면 Subscript out of range(오류 9) 발생. 단 Python COM 환경에서 해당 워크북을 열고 VBA를 실행하는 구조라면 일반적으로 문제없음.

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")
    
    Dim sumRange As Range
    Set sumRange = ws.Range("B4:B23")
    
    Dim totalSales As Double
    totalSales = Application.WorksheetFunction.Sum(sumRange)
    
    ws.Range("B24").Value = totalSales

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## formula_vs_value_paste / write_formula_string — WARN

Prompt:
```text
월별실적 C4(금액)에 매출 금액의 합계를 '구하는 수식'을 넣어줘. 나중에 데이터가 바뀌면 자동으로 갱신되게 =SUM(...) 형태로.
```
Warnings:
- Sonnet 검수 RISK: 사용자 의도(월별실적!C4에 =SUM(...)형태 수식 입력)와 코드 동작이 일치하며, COM 런타임에서도 정상 실행될 것으로 보입니다. 단, NumberFormat을 "General"로 강제 변경하는 부분이 금액 서식을 제거할 수 있고, 외부 참조 수식 특성상 소스 파일을 닫은 후 링크 경고가 발생할 수 있어 RISK로 판정합니다. 치명적 오류는 아니며 수식 입력 자체는 기대 결과와 일치합니다.
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!C4` → =SUM('[input_매출_2026_4월.xlsx]매출'!D2:D1201)
- 근거: 사용자 의도(월별실적!C4에 =SUM(...)형태 수식 입력)와 코드 동작이 일치하며, COM 런타임에서도 정상 실행될 것으로 보입니다. 단, NumberFormat을 "General"로 강제 변경하는 부분이 금액 서식을 제거할 수 있고, 외부 참조 수식 특성상 소스 파일을 닫은 후 링크 경고가 발생할 수 있어 RISK로 판정합니다. 치명적 오류는 아니며 수식 입력 자체는 기대 결과와 일치합니다.
- 위험: 외부 참조 수식('=[workbook]sheet'!range) 은 Excel이 두 파일을 동시에 열고 있을 때는 정상 동작하지만, 나중에 소스 파일을 닫으면 절대경로가 없는 외부 참조로 남아 #REF! 또는 링크 업데이트 경고가 발생할 수 있습니다.
- 위험: COM 환경에서 외부 참조 수식 입력 시, 소스 파일 경로가 .FullName 기반의 절대경로로 고정되지 않아 파일 이동 후 참조가 깨질 수 있습니다.
- 위험: 'input_매출_2026_4월.xlsx' 매출 시트의 D열(금액)이 헤더 기준 4번째 열인데, 스키마 상 헤더는 ['회사명','상품','건수','금액']으로 D열이 맞으나, 실수로 C열(건수)을 참조할 경우에 대한 검증이 없습니다.
- 위험: NumberFormat을 "General"로 바꾸면 기존에 적용된 금액 서식(#,##0 등)이 지워질 수 있습니다.

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드의 핵심 동작은 문제없으나, .NumberFormat을 "General"로 설정하면 금액 열에서 숫자 서식이 제거될 수 있습니다. 금액 셀에는 "#,##0" 등 적절한 서식을 지정하는 것이 더 안전합니다. 또한 formulaStr 변수명을 externalRef로 명확히 분리해 가독성을 높였습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wb As Workbook
    Dim found As Boolean

    ' 소스 워크북 찾기
    found = False
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then
            Set wbSrc = wb
            found = True
            Exit For
        End If
    Next wb
    If Not found Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    ' 대상 워크북 찾기
    found = False
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            Set wbDst = wb
            found = True
            Exit For
        End If
    Next wb
    If Not found Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim wsSrc As Worksheet, wsDst As Worksheet
    Set wsSrc = wbSrc.Worksheets("매출")
    Set wsDst = wbDst.Worksheets("월별실적")

    ' 소스 D열 마지막 행 확인
    Dim lastRowSrc As Long
    lastRowSrc = wsSrc.Cells(wsSrc.Rows.Count, 4).End(xlUp).Row
    If lastRowSrc < 2 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "소스 파일 '매출' 시트에 데이터가 없습니다."
    End If

    ' 외부 참조 수식 문자열 구성 — 시트명에 공백/특수문자 없으므로 홑따옴표 그대로 사용
    ' FormulaLocal 대신 Formula 사용: 시스템 언어 무관하게 안전
    Dim externalRef As String
    externalRef = "'[" & wbSrc.Name & "]매출'!D2:D" & lastRowSrc

    ' C4 셀에 수식 입력 (.Formula 사용, .FormulaLocal 방지)
    With wsDst.Range("C4")
        .NumberFormat = "#,##0"   ' 금액 셀이므로 숫자 서식 적용
        .Formula = "=SUM(" & externalRef & ")"
    End With

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook
    Dim found As Boolean

    ' 소스 워크북 찾기
    found = False
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then
            Set wbSrc = wb
            found = True
            Exit For
        End If
    Next wb
    If Not found Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    ' 대상 워크북 찾기
    found = False
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            Set wbDst = wb
            found = True
            Exit For
        End If
    Next wb
    If Not found Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    ' 시트 설정
    Set wsSrc = wbSrc.Worksheets("매출")
    Set wsDst = wbDst.Worksheets("월별실적")

    ' 소스 데이터 범위 확인 (D열: 금액)
    Dim lastRowSrc As Long
    lastRowSrc = wsSrc.Cells(wsSrc.Rows.Count, 4).End(xlUp).Row
    
    If lastRowSrc < 2 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "소스 파일 '매출' 시트에 데이터가 없습니다."
    End If

    ' 수식 생성: 'input_매출_2026_4월.xlsx'!매출!D2:D[lastRow]
    Dim formulaStr As String
    formulaStr = "='[" & wbSrc.Name & "]매출'!D2:D" & lastRowSrc
    
    ' C4 셀에 수식 입력 (서식 확인 후 입력)
    With wsDst.Range("C4")
        .NumberFormat = "General"
        .Formula = "=SUM(" & formulaStr & ")"
    End With

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## formula_vs_value_paste / write_plain_value — WARN

Prompt:
```text
월별실적 B4(건수)에는 매출 건수 합계를 '값으로' 적어줘. 수식 말고 계산된 숫자. (openpyxl이라 직접 합산해서 넣어.)
```
Warnings:
- Sonnet 검수 RISK: 코드는 COM 런타임 오류 없이 실행될 가능성이 높고, 값으로 쓰는 방식(수식 아님)은 올바르다. 그러나 소스를 '월별집계' 시트의 집계 행에서 읽으므로, 원천 매출 시트(1201행 건수 합산=31139)와 다른 값이 나올 수 있어 사용자 기대값(31139)과 불일치할 가능성이 있다. 또한 행 범위가 하드코딩되어 있어 실제 데이터 구조에 따라 과소/과대 집계 위험이 있으므로 RISK로 판정한다.
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 아니오 · 수식 보존: 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 스키마에서 월별집계 시트의 실제 데이터 행이 명확하지 않으나, 행3~11(상반기 9행) + 행13~21(하반기 9행) B열 숫자 합산 결과. 스키마에 행3=['1월','1077','165496128'], 행4=['2월','1078','105635376']만 예시로 있으므로 실제 합산값은 워크북 내용에 따라 다름. expected=31139이면 일치 여부는 소스 데이터에 달려 있음.
- 근거: 코드는 COM 런타임 오류 없이 실행될 가능성이 높고, 값으로 쓰는 방식(수식 아님)은 올바르다. 그러나 소스를 '월별집계' 시트의 집계 행에서 읽으므로, 원천 매출 시트(1201행 건수 합산=31139)와 다른 값이 나올 수 있어 사용자 기대값(31139)과 불일치할 가능성이 있다. 또한 행 범위가 하드코딩되어 있어 실제 데이터 구조에 따라 과소/과대 집계 위험이 있으므로 RISK로 판정한다.
- 위험: 소스를 '월별집계' 시트에서 읽는데, 이 시트는 이미 집계된 월별 요약 테이블로 원천 매출 건수 합계(31139)와 다를 수 있음
- 위험: 월별집계 시트의 행12는 헤더행(하반기 집계 제목행)이므로 IsNumeric이 False가 되어 건너뛰지만, 행22(분기별 요약) 구간은 합산에서 제외되어 있어 구조 변경 시 누락 위험
- 위험: 하드코딩된 행 범위(3~11, 13~21)는 실제 데이터 행 수와 불일치 가능성이 있음 — 데이터가 부족하거나 더 많을 경우 0 또는 과집계 발생
- 수정 필요: 소스 시트를 '월별집계'가 아닌 원천 데이터인 '매출' 시트 C열(건수)로 변경하여 직접 합산할 것
- 수정 필요: 행 범위 하드코딩 대신 lastRow를 동적으로 구해 전체 데이터를 합산할 것

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_사용자 요청은 '매출 건수 합계'를 B4에 값으로 넣는 것이다. 매출 건수의 원천은 input_매출_2026_4월.xlsx의 '매출' 시트 C열(건수)이며, 1201행 전체를 직접 합산해야 31139가 나온다. 기존 코드는 '월별집계' 시트의 상반기/하반기 집계 행을 읽는데, 이 시트는 이미 집계된 월별 요약값이라 전체 건수 합계와 다를 수 있고 행 범위도 하드코딩되어 있다. 개선안은 원천 데이터 시트(매출 시트 C열)를 직접 합산하여 더 정확하게 총 건수를 구한다._

```vba
Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook

    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Set wsSrc = wbSrc.Worksheets("매출")
    Set wsDst = wbDst.Worksheets("월별실적")

    ' 매출 시트 건수 열(C열) 전체 합산 (헤더 제외, 행2부터 마지막 데이터 행까지)
    Dim totalCount As Double
    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 3).End(xlUp).Row
    Dim r As Long
    For r = 2 To lastRow
        If IsNumeric(wsSrc.Cells(r, 3).Value) And wsSrc.Cells(r, 3).Value <> "" Then
            totalCount = totalCount + CDbl(wsSrc.Cells(r, 3).Value)
        End If
    Next r

    wsDst.Cells(4, 2).Value = totalCount

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook
    Dim found As Boolean

    ' 1. 소스 워크북 찾기 (input_매출_2026_4월.xlsx)
    Set wbSrc = Nothing
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then
            Set wbSrc = wb
            Exit For
        End If
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    ' 2. 대상 워크북 찾기 (output_청구서_템플릿.xlsx)
    Set wbDst = Nothing
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            Set wbDst = wb
            Exit For
        End If
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    ' 3. 시트 참조 설정
    Set wsSrc = wbSrc.Worksheets("월별집계")
    Set wsDst = wbDst.Worksheets("월별실적")

    ' 4. 소스 데이터에서 건수 합계 계산
    ' 스키마에 따르면 "월별집계" 시트에는 상반기(행3~11), 하반기(행13~21) 데이터가 있음
    ' 건수 열은 B열 (헤더 행2 기준: 월, 건수, 금액)
    ' 상반기 건수 합계 (행3~11)
    ' 하반기 건수 합계 (행13~21)
    ' 총합계 = 상반기 + 하반기
    
    Dim totalCount As Double
    Dim r As Long
    
    ' 상반기 건수 합산 (행 3 ~ 11)
    For r = 3 To 11
        If IsNumeric(wsSrc.Cells(r, 2).Value) Then
            totalCount = totalCount + CDbl(wsSrc.Cells(r, 2).Value)
        End If
    Next r
    
    ' 하반기 건수 합산 (행 13 ~ 21)
    For r = 13 To 21
        If IsNumeric(wsSrc.Cells(r, 2).Value) Then
            totalCount = totalCount + CDbl(wsSrc.Cells(r, 2).Value)
        End If
    Next r

    ' 5. 대상 셀에 값으로 입력 (수식 아님)
    wsDst.Cells(4, 2).Value = totalCount

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## formula_vs_value_paste / formula_not_overwrite_existing — FAIL

Prompt:
```text
월별실적 4행 금액에 합계 수식을 넣되, 회사별요약 마진 수식(D열)이나 합계행(24행)은 절대 건드리지 마. 이번엔 월별실적만.
```
Failures:
- Sonnet 검수 FAIL: C4 셀에 =SUM(C4:C7)을 입력하면 C4 자신을 포함하는 순환참조가 발생하여 기대 결과인 '월별실적!C4에 올바른 수식이 들어가는 것'을 충족하지 못합니다. 스키마상 월별실적의 4~7행은 1월~4월 개별 데이터 행으로, C4는 합계를 담을 집계 행이 아니라 1월 금액 셀입니다. 이 수식은 COM 환경에서 순환참조 경고 또는 잘못된 0값 기입으로 이어지므로 의도 불일치 + 런타임 오동작으로 FAIL 판정합니다.
- 수정 필요: C4 셀에 =SUM(C4:C7)을 입력하면 순환참조가 발생하므로, 합계 범위에서 C4 자신을 제외하거나(예: =SUM(C5:C7)) 합계 수식을 별도의 합계 행(예: C8)에 입력해야 함
- 수정 필요: 사용자가 '4행 금액에 합계 수식'이라고 했을 때의 정확한 의미(4행이 합계 행인지, 4행부터 데이터를 집계하는 셀인지)를 스키마 기반으로 재확인하고 범위를 결정해야 함
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **FAIL**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!C4` → =SUM(C4:C7)
  - `회사별요약!D4` → =B4-C4 (변경 없음)
  - `회사별요약!B24` → =SUM(B4:B23) (변경 없음)
- 근거: C4 셀에 =SUM(C4:C7)을 입력하면 C4 자신을 포함하는 순환참조가 발생하여 기대 결과인 '월별실적!C4에 올바른 수식이 들어가는 것'을 충족하지 못합니다. 스키마상 월별실적의 4~7행은 1월~4월 개별 데이터 행으로, C4는 합계를 담을 집계 행이 아니라 1월 금액 셀입니다. 이 수식은 COM 환경에서 순환참조 경고 또는 잘못된 0값 기입으로 이어지므로 의도 불일치 + 런타임 오동작으로 FAIL 판정합니다.
- 위험: C4 셀에 =SUM(C4:C7)을 입력하면 C4 자신을 참조하는 순환참조(circular reference)가 발생하여 Excel이 경고를 표시하거나 값이 0/오류로 계산됨
- 위험: COM 환경에서 순환참조 발생 시 Application.Calculation = xlCalculationManual 상태에서도 오류 없이 0이 입력될 수 있어 조용한 잘못된 값 기입 가능성 있음
- 위험: 월별실적 시트의 4행은 스키마상 '1월' 개별 데이터 행이지 합계 행이 아니므로, 합계 수식을 4행에 넣는 것이 사용자 의도와 다를 수 있음
- 수정 필요: C4 셀에 =SUM(C4:C7)을 입력하면 순환참조가 발생하므로, 합계 범위에서 C4 자신을 제외하거나(예: =SUM(C5:C7)) 합계 수식을 별도의 합계 행(예: C8)에 입력해야 함
- 수정 필요: 사용자가 '4행 금액에 합계 수식'이라고 했을 때의 정확한 의미(4행이 합계 행인지, 4행부터 데이터를 집계하는 셀인지)를 스키마 기반으로 재확인하고 범위를 결정해야 함

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드의 `=SUM(C4:C7)` 수식은 C4 셀 자신을 포함하는 순환참조를 유발합니다. 워크북 스키마상 월별실적 시트의 4~7행은 1월~4월 개별 데이터 행이며 C4가 합계 셀이 아닌 1월 금액 셀로 보이므로, 수식을 삽입할 위치와 참조 범위 모두 재확인이 필요합니다. 순환참조를 방지하려면 최소한 자기 자신을 제외한 범위(예: C5:C7)를 참조하거나, 합계를 위한 별도 행에 수식을 입력해야 합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")

    Dim ws As Worksheet
    Set ws = wb.Worksheets("월별실적")

    ' 4행 금액(C열)에 합계 수식 입력
    ' 월별실적 시트 구조: 3행=헤더, 4~7행=데이터(1월~4월)
    ' C4는 1월 금액 셀이므로, 전체 건수 합계는 C4:C7의 SUM이 아닌
    ' 사용자 의도에 따라 월별 데이터 합계 수식을 입력해야 하나,
    ' C4가 집계 합계 행이라면 =SUM(C5:C7) 등 자기참조 순환 방지 필요.
    ' 스키마상 4행은 '1월' 데이터 행이므로, 여기에 SUM을 넣으면 순환참조 발생.
    ' 올바른 합계 수식 위치는 별도 합계 행(예: C8)이거나,
    ' 사용자가 의도한 범위(C4:C7 또는 특정 범위)를 순환 없이 참조해야 함.
    ' 아래는 C4가 '합계 행'이라는 가정 하에 C5:C7 합계를 입력하는 안전한 예시.
    ' 실제 사용 시 범위를 확인 후 조정 필요.
    ws.Cells(4, 3).Formula = "=SUM(C5:C7)"

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("월별실적")
    
    ' 4행 금액(C열)에 합계 수식 추가
    ' 헤더가 3행이므로 데이터는 4행부터 시작
    ' 합계 수식은 C4:C7 범위(데이터 전체)를 합산
    ws.Cells(4, 3).Formula = "=SUM(C4:C7)"

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## hidden_columns / current_sheet_b_to_d — NEEDS_WINDOWS

Prompt:
```text
매출 시트에서 B열부터 D열까지(상품·건수·금액)만 숨겨줘. 삭제하지 말고 숨김 처리만 해.
```
Needs Windows:
- 매출 시트의 B:D 가 .Hidden=True 로 숨겨지고 데이터/A열은 그대로인지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 매출 시트 B:D 숨김.
- Forbidden pattern absent: \.Delete\b
- Forbidden pattern absent: \.Clear(?:Contents|Formats)?\b
- Forbidden pattern absent: SpecialCells\s*\(\s*xlCellTypeVisible\s*\)
- Uses Hidden=True for hide request.
- No all-worksheet loop for single-sheet request.
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!B열(전체)` → Hidden=True (열 숨김, 데이터 보존)
  - `매출!C열(전체)` → Hidden=True (열 숨김, 데이터 보존)
  - `매출!D열(전체)` → Hidden=True (열 숨김, 데이터 보존)
  - `매출!A열(전체)` → (변경 없음) 회사명 데이터 그대로
  - `매출!B2` → 'B2B 데이터(5G)' 값 그대로 (숨겨졌지만 삭제되지 않음)
  - `매출!C2` → '41' 값 그대로 (숨겨졌지만 삭제되지 않음)
  - `매출!D2` → '1435000' 값 그대로 (숨겨졌지만 삭제되지 않음)
- 근거: 코드는 사용자가 요청한 매출 시트의 B~D열을 Hidden=True로 숨기는 의도를 정확히 수행한다. 셀 값/수식/서식을 일절 수정하지 않고 열 숨김만 처리하므로 데이터 보존 요건도 충족된다. 워크북 탐색 후 없으면 Err.Raise로 명시적 오류를 발생시키고, On Error Resume Next를 사용하지 않아 조용한 실패도 없다. 전체적으로 의도, 범위, 보존 요건을 모두 만족하므로 PASS로 판정한다.
- 위험: Cleanup 레이블에서 On Error GoTo Cleanup 이후 에러 발생 시 raisedNum 저장 후 Err.Raise 로 재전파하는 구조는 정상적으로 동작하나, Cleanup 블록이 정상 실행 경로에서도 통과되므로 의도치 않은 흐름이 될 수 있음(실제 오류 없으면 raisedNum=0 이므로 문제 없음)
- 위험: ws.Range(ws.Columns("B"), ws.Columns("D")).EntireColumn.Hidden = True 구문은 COM 환경에서 일반적으로 정상 동작하나, 시트가 보호된 경우 1004 오류 발생 가능
- 위험: For Each wb In Application.Workbooks 루프로 input_매출_2026_4월.xlsx 를 찾으므로, 해당 워크북이 COM으로 열려 있지 않으면 에러 발생(정상 에러 처리로 래핑됨)

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbSrc.Worksheets("매출")

    ' B열부터 D열까지 숨김 처리
    ws.Range(ws.Columns("B"), ws.Columns("D")).EntireColumn.Hidden = True

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## hidden_columns / mentioned_file_sheet — NEEDS_WINDOWS

Prompt:
```text
@시트[input_매출_2026_4월.xlsx/매출] 여기 B:D를 숨겨줘. 다른 시트는 건드리지 마.

[정확 참조]
- 대상: 파일 "input_매출_2026_4월.xlsx", 시트 "매출", 열 "B:D"
```
Needs Windows:
- 매출 시트의 B:D 가 .Hidden=True 로 숨겨지고 데이터/A열은 그대로인지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 매출 시트 B:D 숨김.
- Forbidden pattern absent: \.Delete\b
- Forbidden pattern absent: \.Clear(?:Contents|Formats)?\b
- Forbidden pattern absent: SpecialCells\s*\(\s*xlCellTypeVisible\s*\)
- Uses Hidden=True for hide request.
- No all-worksheet loop for single-sheet request.
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!B열(B:D 전체)` → Hidden=True (열 숨김, 데이터/수식 보존)
  - `매출!C열` → Hidden=True (열 숨김, 데이터/수식 보존)
  - `매출!D열` → Hidden=True (열 숨김, 데이터/수식 보존)
  - `매출!A열` → (변경 없음) 표시 상태 유지
  - `고객정보 시트` → (변경 없음)
  - `월별집계 시트` → (변경 없음)
- 근거: 코드는 지정된 파일·시트(input_매출_2026_4월.xlsx / 매출)의 B:D 열에만 Hidden=True를 적용하며, 다른 시트를 전혀 건드리지 않는다. 숨김(Hidden) 처리는 셀 값·수식·서식·병합 등을 전혀 변경하지 않으므로 데이터 보존 측면에서도 문제없다. On Error GoTo Cleanup 패턴으로 오류를 포착 후 Err.Raise로 다시 올리므로 조용한 실패도 없다. expected와 완전히 일치한다.
- 위험: Workbooks("input_매출_2026_4월.xlsx")는 해당 파일이 COM 세션에서 이미 열려 있어야 정상 동작함. Python COM 측에서 파일을 열지 않았거나 이름이 미묘하게 다를 경우 subscript out of range(오류 9) 발생 가능. 단, 이는 VBA 자체 문제가 아니라 호출 환경 문제이며 코드에서 Err.Raise로 올바르게 드러남.

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")
    
    ws.Columns("B:D").Hidden = True

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## hidden_columns / natural_language_hide — NEEDS_WINDOWS

Prompt:
```text
매출 시트에서 상품, 건수, 금액 열은 화면에서 안 보이게 가려줘. 지우는 건 아니야.
```
Needs Windows:
- 매출 시트의 B:D 가 .Hidden=True 로 숨겨지고 데이터/A열은 그대로인지 Excel 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 매출 시트 B:D 숨김.
- Forbidden pattern absent: \.Delete\b
- Forbidden pattern absent: \.Clear(?:Contents|Formats)?\b
- Forbidden pattern absent: SpecialCells\s*\(\s*xlCellTypeVisible\s*\)
- Uses Hidden=True for hide request.
- No all-worksheet loop for single-sheet request.
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!B열 (상품)` → Hidden=True (데이터 보존, 숨김만 처리)
  - `매출!C열 (건수)` → Hidden=True (데이터 보존, 숨김만 처리)
  - `매출!D열 (금액)` → Hidden=True (데이터 보존, 숨김만 처리)
  - `매출!A열 (회사명)` → (변경 없음, 그대로 표시)
- 근거: 코드는 'input_매출_2026_4월.xlsx'의 '매출' 시트에서 헤더명('상품','건수','금액')을 동적으로 탐색하여 해당 열에 Hidden=True를 적용한다. 데이터를 삭제하거나 Clear하지 않으며, 수식·서식·병합셀도 건드리지 않는다. 열을 찾지 못하면 Err.Raise로 명시적으로 오류를 드러내며, On Error GoTo Cleanup 후 재발생 구조로 조용한 실패를 방지한다. 기대 결과(B·C·D열 Hidden=True, 데이터 보존)와 완전히 일치하므로 PASS 판정한다.
- 위험: 헤더가 1행에 없을 경우(예: 필터/행 삽입 등으로 hdrRow가 달라진 경우) 열을 찾지 못해 Err.Raise가 발생할 수 있으나, 현재 스키마 상 헤더는 1행으로 확인되므로 실질적 위험 낮음
- 위험: 워크북 'input_매출_2026_4월.xlsx'가 이미 열려 있지 않으면 Workbooks() 참조 시 subscript out of range(9) 오류 발생 — Python COM 주입 환경에서는 해당 파일이 열린 채로 실행되므로 일반적으로 문제 없음
- 위험: 이미 숨겨진 열에 Hidden=True를 재적용해도 오류 없이 no-op으로 처리되므로 중복 실행 안전

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")
    
    Dim hdrRow As Long: hdrRow = 1
    Dim lastCol As Long
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    
    Dim col As Long
    Dim targetCols As Collection
    Set targetCols = New Collection
    Dim headersToHide As Variant
    headersToHide = Array("상품", "건수", "금액")
    Dim h As Variant
    
    For h = LBound(headersToHide) To UBound(headersToHide)
        Dim foundCol As Long: foundCol = 0
        For col = 1 To lastCol
            If Trim(CStr(ws.Cells(hdrRow, col).Value)) = headersToHide(h) Then
                foundCol = col
                Exit For
            End If
        Next col
        If foundCol > 0 Then
            targetCols.Add foundCol
        Else
            Err.Raise vbObjectError + 513, "B2BSkill", "'" & headersToHide(h) & "' 열을 찾지 못했습니다."
        End If
    Next h
    
    Dim c As Variant
    For Each c In targetCols
        ws.Columns(c).Hidden = True
    Next c

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## hidden_rows / hide_two_company_rows — PASS

Prompt:
```text
회사별요약에서 4행(ABC통신)과 5행(글로벌네트워크)을 화면에서 안 보이게 숨겨줘. 삭제하지 말고 숨김 처리만.
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!행4(ABC통신 전체)` → 데이터/수식 그대로 보존, Hidden=True
  - `회사별요약!행5(글로벌네트워크 전체)` → 데이터/수식 그대로 보존, Hidden=True
  - `회사별요약!D4` → =B4-C4 (수식 그대로)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 그대로)
  - `회사별요약!D5` → =B5-C5 (수식 그대로)
  - `회사별요약!E5` → =IFERROR(D5/B5,0) (수식 그대로)
- 근거: 코드는 output_청구서_템플릿.xlsx의 회사별요약 시트 4·5행에 대해 ws.Rows("4:5").Hidden = True 를 정확히 실행한다. 행 데이터(회사명, 마진 수식 등)는 일절 건드리지 않으므로 수식/서식이 온전히 보존된다. 삭제(Delete/Clear) 없이 숨김만 수행하는 사용자 의도와 완전히 일치하며, On Error GoTo Cleanup + 재-Raise 패턴으로 오류를 조용히 삼키지 않는다.
- 위험: output_청구서_템플릿.xlsx 가 Python COM 세션에서 열려 있지 않으면 Err.Raise vbObjectError+515 로 실패하지만, 이는 의도된 안전 동작이므로 실제 위험은 낮음
- 위험: 병합셀 A1:E1 이 있으나 Rows.Hidden 은 병합셀 여부와 무관하게 동작하므로 문제 없음
- 위험: ws.Rows("4:5").Hidden = True 는 시트 보호(Protect) 상태에서 1004 오류를 낼 수 있으나 해당 시트가 보호되어 있다는 정보는 없음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim wbTarget As Workbook
    Set wbTarget = Nothing
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            Set wbTarget = wb
            Exit For
        End If
    Next wb
    If wbTarget Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbTarget.Worksheets("회사별요약")

    ' 4행과 5행 숨김 처리
    ws.Rows("4:5").Hidden = True

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## hidden_rows / hide_summary_row — PASS

Prompt:
```text
회사별요약 합계/평균 행(24행)을 잠깐 숨겨줘. 지우면 안 되고 숨기기만.
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!24행 전체` → hidden=True (행 숨김, 데이터/수식 보존)
  - `회사별요약!D24` → =SUM(D4:D23) (수식 그대로 보존, 숨겨졌을 뿐 삭제되지 않음)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 그대로 보존, 숨겨졌을 뿐 삭제되지 않음)
- 근거: 코드는 output_청구서_템플릿.xlsx의 회사별요약 시트 24행에 대해 ws.Rows(24).Hidden = True 를 수행하며, 이는 사용자 요청(삭제 금지, 숨기기만)과 정확히 일치한다. 수식(D24=SUM, E24=AVERAGE)은 값을 덮어쓰지 않으므로 그대로 보존된다. 오류 발생 시 Cleanup 레이블로 이동 후 Err.Raise 로 재전파하므로 조용한 실패도 없다. 전반적으로 의도 부합·수식 보존·범위 한정이 모두 충족된 안전한 코드다.
- 위험: 보호된 시트(Protected Sheet)일 경우 ws.Rows(24).Hidden = True 가 런타임 오류 1004를 발생시킬 수 있으나, 이는 일반적인 케이스이므로 낮은 위험
- 위험: 해당 워크북이 COM 세션에 열려 있지 않은 경우 vbObjectError+515 로 정상 Raise됨 — 오류 처리 자체는 적절

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim wbTarget As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            Set wbTarget = wb
            Exit For
        End If
    Next wb
    If wbTarget Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbTarget.Worksheets("회사별요약")

    ws.Rows(24).Hidden = True

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## hidden_rows / hide_not_delete_emphasis — PASS

Prompt:
```text
회사별요약 6행을 숨겨줘. delete_rows 같은 삭제는 절대 쓰지 말고 행 숨김만 해.
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!행6(전체)` → Hidden=True (값/수식 불변, 데이터 보존)
  - `회사별요약!D6` → =B6-C6 (수식 그대로 유지, 숨김만 적용)
  - `회사별요약!E6` → =IFERROR(D6/B6,0) (수식 그대로 유지, 숨김만 적용)
- 근거: 코드는 ws.Rows(6).Hidden = True 로 행 숨김만 수행하며, delete_rows 등 삭제 연산을 일절 사용하지 않는다. 대상 파일과 시트를 명시적으로 지정하고, 6행 전체를 숨기되 값/수식을 건드리지 않으므로 의도에 완전히 부합한다. 에러 발생 시 Err.Raise 로 드러내는 구조도 올바르며, On Error GoTo Cleanup 패턴도 조용한 무시가 아니라 재발생 방식이라 허용 가능하다.
- 위험: output_청구서_템플릿.xlsx 파일이 Python COM 환경에서 이미 열려 있어야 Workbooks() 참조가 성공함. 파일이 열려 있지 않으면 Subscript out of range(9) 오류가 발생하지만, 이는 호출 환경(Python COM 주입 방식)에서 파일을 열고 실행하는 구조라면 문제없음.
- 위험: 회사별요약 시트의 6행이 병합셀을 포함하는 경우 Hidden 처리는 정상 동작하지만, 병합 범위에 따라 일부 병합이 시각적으로 깨져 보일 수 있음(데이터는 보존)

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")
    
    ws.Rows(6).Hidden = True

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## insert_columns_no_residual_formula / insert_six_columns_front — NEEDS_WINDOWS

Prompt:
```text
회사별요약 기존 데이터 앞(A열 앞)에 빈 열 6개를 삽입해줘. 옆으로 밀려난 마진/마진율 수식이 잔존하거나 새 수식이 잘못 생기지 않게, 전체 열 삽입으로 참조가 Excel 방식으로 자동 보정되게 해.
```
Needs Windows:
- 회사별요약 A열 앞 6개 빈 열이 삽입되고 마진/마진율 수식 참조가 Excel 방식으로 자동 보정되며 새 열엔 수식이 없는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 전체 열 삽입.
- Forbidden pattern absent: \.Range\s*\(\s*\.Cells\s*\([^)]*\)\s*,\s*\.Cells\s*\([^)]*\)\s*\)\.Insert\b
- Forbidden pattern absent: \.Formula(?:R1C1)?\s*=\s*[\"']=
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Uses whole-column Insert (Excel auto-adjusts references).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A1:F1` → 빈 열 6개 삽입됨 (기존 A1:E1 병합셀은 G1:K1로 이동, 병합 자동 보정)
  - `회사별요약!G3` → 회사명 (기존 A3에서 G3으로 이동)
  - `회사별요약!H3` → 매출 (기존 B3에서 H3으로 이동)
  - `회사별요약!I3` → 원가 (기존 C3에서 I3으로 이동)
  - `회사별요약!J3` → 마진 (기존 D3에서 J3으로 이동)
  - `회사별요약!K3` → 마진율 (기존 E3에서 K3으로 이동)
  - `회사별요약!J4` → =H4-I4 (기존 =B4-C4 → 열 삽입으로 자동 보정)
  - `회사별요약!K4` → =IFERROR(J4/H4,0) (기존 =IFERROR(D4/B4,0) → 자동 보정)
  - `회사별요약!J24` → =SUM(J4:J23) (기존 =SUM(D4:D23) → 자동 보정)
  - `회사별요약!K24` → =AVERAGE(K4:K23) (기존 =AVERAGE(E4:E23) → 자동 보정)
  - `회사별요약!A1` → 빈 셀 (새로 삽입된 빈 열 1번째)
  - `회사별요약!B1` → 빈 셀 (새로 삽입된 빈 열 2번째)
  - `회사별요약!C1` → 빈 셀 (새로 삽입된 빈 열 3번째)
  - `회사별요약!D1` → 빈 셀 (새로 삽입된 빈 열 4번째)
  - `회사별요약!E1` → 빈 셀 (새로 삽입된 빈 열 5번째)
  - `회사별요약!F1` → 빈 셀 (새로 삽입된 빈 열 6번째)
- 근거: 코드는 대상 워크북(output_청구서_템플릿.xlsx)과 시트(회사별요약)를 정확히 찾고, ws.Columns('A:F').Insert Shift:=xlToRight 로 전체 열 6개를 삽입한다. 이 방식은 Excel이 열 삽입 시 기존 수식의 셀 참조를 자동 보정하는 메커니즘을 그대로 활용하므로 마진/마진율 수식(=B4-C4, =IFERROR(D4/B4,0) 등)이 열 이동 후 =H4-I4, =IFERROR(J4/H4,0)로 올바르게 갱신된다. On Error GoTo Cleanup 구조에서 에러 번호를 저장 후 재발생시키므로 조용한 실패도 없다. 사용자 의도와 완전히 일치하고 COM 런타임 실패 가능성도 낮아 PASS로 판정한다.
- 위험: 기존 A1:E1 병합 범위가 삽입 후 G1:K1로 이동하지만, Excel COM 에서 병합셀 참조 보정은 정상적으로 이루어지므로 실제 오류 가능성은 낮음
- 위험: Application.Calculation = xlCalculationManual 상태에서 Cleanup 이후 prevCalc 로 복원하므로 수식 재계산 타이밍은 복원 후 정상 동작할 것임
- 위험: 다른 시트(월별실적, a, 회귀_삽입삭제 등)에서 회사별요약 시트 셀을 외부 참조하는 수식이 있다면 해당 참조도 자동 보정되나, 없는 경우 무관

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook, ws As Worksheet
    ' 대상 워크북 찾기
    Dim wbFound As Workbook
    For Each wbFound In Application.Workbooks
        If wbFound.Name = "output_청구서_템플릿.xlsx" Then
            Set wb = wbFound
            Exit For
        End If
    Next wbFound
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx'가 열려 있지 않습니다."

    ' 대상 시트 찾기
    Dim sh As Worksheet
    For Each sh In wb.Worksheets
        If sh.Name = "회사별요약" Then
            Set ws = sh
            Exit For
        End If
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."

    ' A열 앞에 빈 열 6개 삽입 (전체 열 삽입으로 병합/수식 참조 자동 보정)
    ws.Columns("A:F").Insert Shift:=xlToRight

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## insert_columns_no_residual_formula / insert_columns_no_new_formula — NEEDS_WINDOWS

Prompt:
```text
회사별요약 맨 앞에 열 몇 개를 끼워넣되 그 새 열에는 수식을 넣지 마. 기존 마진/마진율 수식이 밀리면서 중복되거나 깨지면 안 돼.
```
Needs Windows:
- 회사별요약 A열 앞 6개 빈 열이 삽입되고 마진/마진율 수식 참조가 Excel 방식으로 자동 보정되며 새 열엔 수식이 없는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 전체 열 삽입.
- Forbidden pattern absent: \.Range\s*\(\s*\.Cells\s*\([^)]*\)\s*,\s*\.Cells\s*\([^)]*\)\s*\)\.Insert\b
- Forbidden pattern absent: \.Formula(?:R1C1)?\s*=\s*[\"']=
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Uses whole-column Insert (Excel auto-adjusts references).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A1:G1(삽입 후)` → 병합셀이 A1:G1로 자동 확장(Excel이 전체열 삽입 시 병합 범위를 자동 보정)
  - `회사별요약!C3(삽입 후)` → '회사명' (헤더, 원래 A3가 C3로 밀림)
  - `회사별요약!D3(삽입 후)` → '매출' (원래 B3)
  - `회사별요약!E3(삽입 후)` → '원가' (원래 C3)
  - `회사별요약!F4(삽입 후)` → =D4-E4 (원래 =B4-C4 → Excel이 참조를 자동 보정)
  - `회사별요약!G4(삽입 후)` → =IFERROR(F4/D4,0) (원래 =IFERROR(D4/B4,0) → 자동 보정)
  - `회사별요약!F5(삽입 후)` → =D5-E5 (자동 보정)
  - `회사별요약!G5(삽입 후)` → =IFERROR(F5/D5,0) (자동 보정)
  - `회사별요약!F24(삽입 후)` → =SUM(F4:F23) (원래 =SUM(D4:D23) → 자동 보정)
  - `회사별요약!G24(삽입 후)` → =AVERAGE(G4:G23) (원래 =AVERAGE(E4:E23) → 자동 보정)
  - `회사별요약!A열(삽입 후)` → 빈 열 (새로 삽입, 수식 없음)
  - `회사별요약!B열(삽입 후)` → 빈 열 (새로 삽입, 수식 없음)
- 근거: Columns("A:B").Insert Shift:=xlToRight는 전체 열 삽입이므로 Excel이 기존 D/E열의 수식 참조(B4-C4, IFERROR(D4/B4,0) 등)를 자동으로 보정해주며 수식 중복이나 파괴가 발생하지 않는다. 새 A·B열은 빈 상태로 삽입되어 수식이 들어가지 않는다. 병합셀 A1:E1도 삽입 후 A1:G1로 자동 확장되어 1004 오류 없이 정상 처리된다. 에러 처리도 On Error Resume Next 없이 Err.Raise로 드러내도록 구성되어 있어 COM 환경에서 안전하다.
- 위험: ws.Columns("A:B").Insert 시 기존 A1:E1 병합셀이 A1:G1로 자동 확장되는 것은 Excel COM에서 정상 동작하나, 병합 범위 크기 변화로 인해 이후 코드가 해당 병합을 명시적으로 참조할 경우 범위 불일치 발생 가능(본 코드에서는 해당 없음)
- 위험: 삽입 열 수(2열)가 사용자 요청('열 몇 개')에 대해 임의로 2로 결정됨 — 사용자가 다른 수를 원했다면 수정 필요

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook, ws As Worksheet
    ' 대상 워크북 찾기
    Dim wbFound As Workbook
    For Each wbFound In Application.Workbooks
        If wbFound.Name = "output_청구서_템플릿.xlsx" Then Set wb = wbFound: Exit For
    Next wbFound
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    ' 대상 시트 찾기
    Dim sh As Worksheet
    For Each sh In wb.Worksheets
        If sh.Name = "회사별요약" Then Set ws = sh: Exit For
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."

    ' 맨 앞에 2열 삽입 (전체 열 삽입으로 병합 셀 A1:E1 안전 보장)
    ws.Columns("A:B").Insert Shift:=xlToRight

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## insert_columns_no_residual_formula / insert_blank_columns_preserve — NEEDS_WINDOWS

Prompt:
```text
회사별요약 A열 앞에 빈 열들을 삽입해줘. 기존 마진/마진율 수식 참조는 그대로 유지되어야 하고, 삽입된 빈 열에 옛날 수식이 남아있으면 안 돼.
```
Warnings:
- Sonnet 검수 RISK: 코드 자체는 COM 런타임에서 오류 없이 실행되고 Excel의 수식 자동 참조 보정도 정상 동작합니다. 그러나 사용자가 '빈 열들(복수)'을 요청했음에도 A열 1개만 삽입하여 의도와 부분 불일치가 존재합니다. 또한 Insert 시 CopyOrigin이 지정되지 않아 인접 열 서식이 복사될 수 있으며, 이는 '삽입된 빈 열에 옛날 수식이 남아있으면 안 된다'는 조건을 위반할 잠재 위험이 있습니다. 따라서 RISK로 판정합니다.
Needs Windows:
- 회사별요약 A열 앞 6개 빈 열이 삽입되고 마진/마진율 수식 참조가 Excel 방식으로 자동 보정되며 새 열엔 수식이 없는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 전체 열 삽입.
- Forbidden pattern absent: \.Range\s*\(\s*\.Cells\s*\([^)]*\)\s*,\s*\.Cells\s*\([^)]*\)\s*\)\.Insert\b
- Forbidden pattern absent: \.Formula(?:R1C1)?\s*=\s*[\"']=
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Uses whole-column Insert (Excel auto-adjusts references).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A1(삽입 후)` → 빈 셀 (신규 A열)
  - `회사별요약!B1:F1(삽입 후)` → 기존 A1:E1 병합이 B1:F1로 이동(병합 유지)
  - `회사별요약!B3(삽입 후)` → '회사명' (기존 A3가 B3로 이동)
  - `회사별요약!E4(삽입 후, 기존 D4)` → =C4-D4 (Excel이 참조 자동 보정: 기존 =B4-C4 → B→C, C→D)
  - `회사별요약!F4(삽입 후, 기존 E4)` → =IFERROR(E4/C4,0) (자동 보정)
  - `회사별요약!E24(삽입 후, 기존 D24)` → =SUM(E4:E23) (자동 보정)
  - `회사별요약!F24(삽입 후, 기존 E24)` → =AVERAGE(F4:F23) (자동 보정)
  - `회사별요약!A열 전체(삽입된 열)` → 완전히 빈 상태 (값/수식 없음)
- 근거: 코드 자체는 COM 런타임에서 오류 없이 실행되고 Excel의 수식 자동 참조 보정도 정상 동작합니다. 그러나 사용자가 '빈 열들(복수)'을 요청했음에도 A열 1개만 삽입하여 의도와 부분 불일치가 존재합니다. 또한 Insert 시 CopyOrigin이 지정되지 않아 인접 열 서식이 복사될 수 있으며, 이는 '삽입된 빈 열에 옛날 수식이 남아있으면 안 된다'는 조건을 위반할 잠재 위험이 있습니다. 따라서 RISK로 판정합니다.
- 위험: 사용자가 '빈 열들(복수)'을 요청했으나 코드는 A열 1개만 삽입함 — 의도한 삽입 개수가 불명확하므로 과소 삽입 가능성 있음
- 위험: ws.Columns("A").Insert 는 인접 열(기존 A열)의 서식을 새 열에 복사할 수 있음(CopyOrigin 미지정). 이 경우 삽입된 열이 완전히 빈 상태가 아닐 수 있음
- 위험: A1:E1 병합 셀이 존재하는 시트에서 A열 전체 Insert는 병합을 B1:F1로 밀어내므로 이후 스크립트가 A1:E1을 가정하면 오류 발생 가능
- 위험: 회사별요약 이외 시트의 다른 수식이 회사별요약 열을 참조하는 경우 열 삽입으로 해당 참조도 자동 보정되나, 의도치 않은 연쇄 영향 가능성 있음
- 수정 필요: 삽입할 열 개수를 명시하거나 사용자에게 확인(1열인지 복수인지) — '열들' 요청에 1열만 삽입하는 것은 의도 불일치
- 수정 필요: ws.Columns("A").Insert 시 CopyOrigin:=xlFormatFromRightOrBelow 또는 삽입 후 ClearFormats 추가하여 잔존 서식 방지

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_기존 코드는 1열만 삽입하지만 사용자가 '빈 열들(복수)'을 요청했으므로 삽입 개수에 대한 처리가 모호합니다. 개선안은 countToInsert 변수로 개수를 명시적으로 관리하고, CopyOrigin:=xlFormatFromRightOrBelow 옵션으로 기존 데이터 서식이 신규 열에 복사되지 않도록 하며, 삽입 직후 ClearContents로 잔존 수식/서식이 없음을 보장합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")

    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")

    ' 사용자가 "빈 열들"이라고 했으나 구체적 개수가 명시되지 않음.
    ' 가장 안전한 해석: 1열 삽입 (필요 시 countToInsert를 변경)
    Dim countToInsert As Long
    countToInsert = 1

    ' 전체 열 삽입: Excel이 기존 수식 참조를 자동 보정함
    ' 삽입 후 새 A열은 빈 상태 → 잔존 수식 없음
    ws.Columns("A").Resize(1, countToInsert).Insert Shift:=xlToRight, CopyOrigin:=xlFormatFromRightOrBelow

    ' 삽입된 열에 혹시라도 서식/수식이 복사되었을 경우를 대비해 명시적으로 지움
    ws.Columns("A").Resize(1, countToInsert).ClearContents

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")
    
    ' A열 앞에 빈 열 삽입 (기본 1열)
    ' 전체 열을 삽입하면 병합 셀(A1:E1)도 함께 밀려나며 안전합니다.
    ' 수식 참조는 Excel이 자동으로 업데이트합니다.
    ws.Columns("A").Insert Shift:=xlToRight
    
    ' 삽입된 열은 이미 빈 상태이므로 추가 작업 불필요

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## insert_entire_row / insert_blank_row_between — NEEDS_WINDOWS

Prompt:
```text
회사별요약 헤더(3행) 아래에 빈 행 하나를 삽입해줘. 셀 하나만 밀지 말고 행 전체를 삽입해.
```
Needs Windows:
- 행 전체가 삽입되어 표 전체가 한 행씩 내려가는지(셀 1개만 삽입 아님) 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 행 전체 삽입.
- Forbidden pattern absent: \.Cells\s*\(\s*\d+\s*,\s*\d+\s*\)\s*\.\s*Insert\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Inserts whole row(s) (Rows/EntireRow.Insert).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A4` → (빈 셀 - 새로 삽입된 빈 행)
  - `회사별요약!B4` → (빈 셀)
  - `회사별요약!C4` → (빈 셀)
  - `회사별요약!D4` → (빈 셀)
  - `회사별요약!E4` → (빈 셀)
  - `회사별요약!A5` → ABC통신 (기존 4행이 5행으로 내려감)
  - `회사별요약!D5` → =B5-C5 (수식 자동 조정됨)
  - `회사별요약!E5` → =IFERROR(D5/B5,0) (수식 자동 조정됨)
  - `회사별요약!D25` → =SUM(D5:D24) (기존 D24 합계 수식이 25행으로 이동 및 범위 자동 조정)
  - `회사별요약!E25` → =AVERAGE(E5:E24) (기존 E24 평균 수식이 25행으로 이동 및 범위 자동 조정)
- 근거: 코드는 output_청구서_템플릿.xlsx 의 '회사별요약' 시트를 정확히 찾고, ws.Rows(4).EntireRow 가 아닌 ws.Rows(4).Insert Shift:=xlDown 을 사용하여 행 전체를 삽입한다. Rows(4) 는 이미 EntireRow를 의미하므로 기존 데이터(4행~24행)가 한 행씩 아래로 밀리며 수식 참조도 자동 조정된다. On Error GoTo Cleanup + Err.Raise 재발생 패턴으로 오류를 숨기지 않고, ScreenUpdating/Calculation 복원도 올바르게 처리되어 COM 런타임 안전성이 충분하다.
- 위험: ws.Rows(4).Insert 시 회사별요약 시트에 병합셀(A1:E1)이 존재하지만 1행이므로 4행 삽입에는 영향 없음 — 실질적 위험 없음
- 위험: 시트 보호가 설정되어 있을 경우 1004 오류 발생 가능하나, 스키마상 보호 여부 미기재로 추정 위험 낮음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Dim sh As Worksheet
    For Each sh In wbDst.Worksheets
        If sh.Name = "회사별요약" Then Set ws = sh: Exit For
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."

    ' 4행 전체 삽입 (셀 하나가 아닌 행 전체)
    ws.Rows(4).Insert Shift:=xlDown

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## insert_entire_row / insert_rows_each_group — NEEDS_WINDOWS

Prompt:
```text
매출 시트에서 데이터 맨 위(2행)에 빈 행 한 줄을 행 전체로 삽입해줘.
```
Needs Windows:
- 행 전체가 삽입되어 표 전체가 한 행씩 내려가는지(셀 1개만 삽입 아님) 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 행 전체 삽입.
- Forbidden pattern absent: \.Cells\s*\(\s*\d+\s*,\s*\d+\s*\)\s*\.\s*Insert\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Inserts whole row(s) (Rows/EntireRow.Insert).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!A2(삽입 후)` → (빈 셀)
  - `매출!B2(삽입 후)` → (빈 셀)
  - `매출!C2(삽입 후)` → (빈 셀)
  - `매출!D2(삽입 후)` → (빈 셀)
  - `매출!A3(삽입 후, 기존 2행 데이터)` → ABC통신
  - `매출!B3(삽입 후)` → B2B 데이터(5G)
  - `매출!C3(삽입 후)` → 41
  - `매출!D3(삽입 후)` → 1435000
- 근거: ws.Rows(2).Insert Shift:=xlDown 는 엑셀 행 전체를 삽입하는 올바른 방식으로, 셀 1개만 삽입하는 오류 없이 2행 전체에 빈 행을 삽입한다. 대상 시트('매출')와 파일('input_매출_2026_4월.xlsx')도 사용자 요청과 정확히 일치한다. 기존 데이터(행 2~)는 한 행 아래로 밀려 보존되며 수식/서식도 유지된다. Cleanup 레이블을 통해 오류를 재발생시키는 구조도 적절하다.
- 위험: ws.Rows(2).Insert 는 행 전체 삽입이므로 기능 자체는 정확하나, 보호(Protected) 시트일 경우 런타임 1004 오류 가능. 현재 스키마 상 시트 보호 여부 미확인이나 일반적 위험도는 낮음.
- 위험: Workbooks 루프로 'input_매출_2026_4월.xlsx' 를 찾는 방식은 해당 파일이 Python COM 세션에서 별도로 열려 있어야 동작함. COM 주입 실행 시 워크북이 이미 열린 상태여야 하며, 닫혀 있으면 vbObjectError+515 를 발생시켜 정상 실패함(의도적 설계로 적절).

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbSrc.Worksheets("매출")

    ' 2행 전체에 빈 행 삽입
    ws.Rows(2).Insert Shift:=xlDown

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## insert_entire_row / insert_full_row_top — NEEDS_WINDOWS

Prompt:
```text
월별실적 표 맨 위에 빈 행을 하나 넣어줘. 행 전체가 삽입돼서 아래로 한 칸씩 밀려야 해.
```
Warnings:
- Sonnet 검수 RISK: '월별실적' 시트 스키마상 헤더는 행3이고 데이터는 행4부터 시작한다. 사용자가 요청한 '표 맨 위에 빈 행 삽입'은 표 헤더인 행3 바로 위(즉 행3 위치에 EntireRow 삽입)를 의미하는데, 현재 코드는 ws.Rows(1).Insert로 시트 맨 첫 번째 행에 삽입하여 표 범위와 무관한 위치를 수정하게 된다. 전월대비 수식(D5=C5-C4 등)은 상대참조이므로 행 삽입 시 자동 조정되어 보존되지만, 삽입 위치 자체가 잘못되었으므로 의도 불일치 판정이다.
Needs Windows:
- 행 전체가 삽입되어 표 전체가 한 행씩 내려가는지(셀 1개만 삽입 아님) 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 행 전체 삽입.
- Forbidden pattern absent: \.Cells\s*\(\s*\d+\s*,\s*\d+\s*\)\s*\.\s*Insert\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Inserts whole row(s) (Rows/EntireRow.Insert).
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 아니오 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!A1(삽입 후 구 A1 위치)` → (새 빈 행 삽입됨 — 원래 행1이 행2로 밀림)
  - `월별실적!행3(구 헤더행 — 원래 행3이 행4로)` → (헤더 행이 행4로 밀림)
  - `월별실적!D6(구 D5==C5-C4 → 삽입 후 행6)` → =C6-C5 (상대참조이므로 자동 조정됨)
  - `월별실적!행3(삽입 전 헤더)` → 삽입 후 행4로 이동: ['월','건수','금액','전월대비']
  - `월별실적!A3(삽입 전 표 맨 위 행)` → 삽입 후 A1에 빈 행이 생기고 기존 행들이 전부 1씩 아래로 밀림
- 근거: '월별실적' 시트 스키마상 헤더는 행3이고 데이터는 행4부터 시작한다. 사용자가 요청한 '표 맨 위에 빈 행 삽입'은 표 헤더인 행3 바로 위(즉 행3 위치에 EntireRow 삽입)를 의미하는데, 현재 코드는 ws.Rows(1).Insert로 시트 맨 첫 번째 행에 삽입하여 표 범위와 무관한 위치를 수정하게 된다. 전월대비 수식(D5=C5-C4 등)은 상대참조이므로 행 삽입 시 자동 조정되어 보존되지만, 삽입 위치 자체가 잘못되었으므로 의도 불일치 판정이다.
- 위험: ws.Rows(1).Insert는 시트 맨 위(행1)에 빈 행을 삽입하므로, 표 헤더가 행3에 있는 '월별실적' 표 구조에는 영향이 없거나 의도와 다른 위치에 빈 행이 생김
- 위험: 표 맨 위(행3)에 삽입해야 하는데 행1에 삽입하면 표 데이터가 밀리지 않아 no-op에 가까운 결과가 됨
- 위험: 행1에 기존 데이터가 있을 경우(스키마상 행1은 빈 행으로 보이나 불확실) 시트 전체 레이아웃이 예기치 않게 변경될 수 있음
- 수정 필요: ws.Rows(1).Insert를 ws.Rows(3).EntireRow.Insert Shift:=xlDown 으로 수정하여 표 헤더가 있는 행3 위에 빈 행을 삽입할 것

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_현재 코드는 ws.Rows(1).Insert로 시트 맨 첫 번째 행에 빈 행을 삽입하지만, 스키마에 따르면 '월별실적' 시트의 표는 행3(헤더)부터 시작하므로 표 맨 위는 행3입니다. 행1에 삽입하면 표와 무관한 시트 최상단에만 빈 행이 생겨 표 구조가 의도대로 밀리지 않습니다. ws.Rows(3).EntireRow.Insert Shift:=xlDown으로 변경해야 표 헤더(행3)와 데이터 전체가 한 칸씩 아래로 정확히 밀립니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Dim sh As Worksheet
    For Each sh In wbDst.Worksheets
        If sh.Name = "월별실적" Then Set ws = sh: Exit For
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'월별실적' 시트를 찾지 못했습니다."

    ' 월별실적 표 맨 위(헤더 포함 시 행3, 데이터 시작은 행3) 기준:
    ' 스키마상 헤더가 행3이고 데이터가 행4부터이므로,
    ' 표 맨 위 = 행3 위에 빈 행 삽입 → 기존 행3이 행4로 밀림
    ws.Rows(3).EntireRow.Insert Shift:=xlDown

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Dim sh As Worksheet
    For Each sh In wbDst.Worksheets
        If sh.Name = "월별실적" Then Set ws = sh: Exit For
    Next sh
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'월별실적' 시트를 찾지 못했습니다."

    ' 1행 전체 삽입 (아래로 밀림)
    ws.Rows(1).Insert Shift:=xlDown

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## merged_cell_block / edit_title_keep_merge — PASS

Prompt:
```text
회사별요약 시트 맨 위 제목 칸(A1:E1 병합)에 적힌 제목을 '2026년 4월 청구 요약'으로 바꿔줘. 병합은 그대로 유지하고 텍스트만 고쳐.
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A1` → 2026년 4월 청구 요약
  - `회사별요약!B1` → (변경 없음 — 병합된 빈 셀)
  - `회사별요약!D4` → =B4-C4
  - `회사별요약!E4` → =IFERROR(D4/B4,0)
  - `회사별요약!D24` → =SUM(D4:D23)
  - `회사별요약!E24` → =AVERAGE(E4:E23)
- 근거: 코드는 output_청구서_템플릿.xlsx 워크북의 '회사별요약' 시트를 정확히 찾고, 병합 셀의 좌상단인 A1에만 .Value를 써서 텍스트를 변경한다. 병합 해제·수식 덮어쓰기 등의 부작용이 없으며, 다른 시트나 수식 셀(D/E열)을 건드리지 않는다. 에러 발생 시 Err.Raise로 재발행하여 조용한 실패를 방지하고 있어 의도와 완전히 일치한다.
- 위험: 병합 셀 A1:E1 의 좌상단(A1)에만 .Value 를 쓰므로 정상 동작하지만, 만약 A1이 병합의 좌상단이 아닌 다른 셀을 대상으로 호출하면 1004 오류 발생 가능성이 있음(본 코드는 항상 A1을 지정하므로 해당 없음).
- 위험: Cleanup 레이블 이후 'On Error GoTo 0' 리셋 없이 raisedNum 체크로만 에러를 재발행하는 패턴은 일부 COM 환경에서 에러 컨텍스트가 이미 소멸되어 Err.Raise 가 0번 에러로 전달될 수 있음(실제 영향은 미미함).

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim ws As Worksheet
    
    ' 대상 워크북 찾기
    Dim wbFound As Workbook
    For Each wbFound In Application.Workbooks
        If wbFound.Name = "output_청구서_템플릿.xlsx" Then
            Set wb = wbFound
            Exit For
        End If
    Next wbFound
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    
    ' 대상 시트 찾기
    Dim wsFound As Worksheet
    For Each wsFound In wb.Worksheets
        If wsFound.Name = "회사별요약" Then
            Set ws = wsFound
            Exit For
        End If
    Next wsFound
    If ws Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."
    
    ' A1 셀 값 변경 (병합은 유지)
    ws.Range("A1").Value = "2026년 4월 청구 요약"

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## merged_cell_block / unmerge_title — PASS

Prompt:
```text
회사별요약 제목 줄(A1부터 E1까지)의 셀 병합을 풀어줘. 병합만 해제하면 돼.
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A1` → 기존 병합셀의 값(제목 텍스트)이 A1에 잔존, 병합 해제됨
  - `회사별요약!B1` → (빈 값, 병합 해제 후 개별 셀)
  - `회사별요약!C1` → (빈 값, 병합 해제 후 개별 셀)
  - `회사별요약!D1` → (빈 값, 병합 해제 후 개별 셀)
  - `회사별요약!E1` → (빈 값, 병합 해제 후 개별 셀)
  - `회사별요약!D4` → =B4-C4 (수식 불변)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 불변)
  - `회사별요약!D24` → =SUM(D4:D23) (수식 불변)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 불변)
- 근거: 코드는 'output_청구서_템플릿.xlsx'의 '회사별요약' 시트를 정확히 찾아 A1:E1 병합을 UnMerge로 해제하며, 다른 셀/수식/서식에는 전혀 접근하지 않는다. 병합 해제는 데이터 파괴 없이 A1에 기존 값만 잔존시키므로 expected와 일치한다. COM 런타임 관점에서 UnMerge는 보호되지 않은 시트에서 1004 없이 정상 동작하며, 에러 핸들링도 Err.Raise로 투명하게 노출된다.
- 위험: 병합이 이미 해제된 상태라면 Err.Raise로 오류를 발생시키므로, 멱등성이 없음 — 단, 이번 요청 의도('병합 해제')에서는 허용 범위 내
- 위험: Cleanup 레이블에서 Err.Number 를 체크할 때 On Error GoTo Cleanup 이후 분기 직후에 Err.Number가 0으로 리셋될 수 있는 VBA 타이밍 이슈가 미미하게 존재하나 실질적 위험은 낮음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Dim wbFound As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            Set wbFound = wb
            Exit For
        End If
    Next wb
    If wbFound Is Nothing Then
        Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    End If

    Dim ws As Worksheet
    Dim sh As Worksheet
    For Each sh In wbFound.Worksheets
        If sh.Name = "회사별요약" Then
            Set ws = sh
            Exit For
        End If
    Next sh
    If ws Is Nothing Then
        Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."
    End If

    Dim targetRng As Range
    Set targetRng = ws.Range("A1:E1")
    
    If targetRng.MergeCells Then
        targetRng.UnMerge
    Else
        Err.Raise vbObjectError + 514, "B2BSkill", "지정된 범위(A1:E1)가 이미 병합되어 있지 않습니다."
    End If

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## merged_cell_block / no_copy_for_merge_region — PASS

Prompt:
```text
회사별요약 A1:E1 병합 제목을 COM 복사(src.Copy) 말고 openpyxl 방식으로 안전하게 다뤄줘 — 제목 텍스트를 '청구 요약(4월)'로만 바꾸면 돼.

[정확 참조]
- 대상: 파일 "output_청구서_템플릿.xlsx", 시트 "회사별요약", 병합 "A1:E1"
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A1` → 청구 요약(4월)
  - `회사별요약!B1` → (변경 없음 — 병합 셀 내 빈 셀, 유지)
  - `회사별요약!D4` → =B4-C4
  - `회사별요약!E4` → =IFERROR(D4/B4,0)
  - `회사별요약!D24` → =SUM(D4:D23)
  - `회사별요약!E24` → =AVERAGE(E4:E23)
- 근거: 코드는 병합 셀 A1:E1의 기준 셀인 A1에 직접 Value를 대입하는 방식으로, 병합 상태와 서식을 그대로 유지하면서 텍스트만 변경합니다. openpyxl 방식 요청의 핵심 의도(Copy/PasteSpecial 없이 안전하게 텍스트만 수정)를 VBA에서 가장 단순·안전한 방법으로 달성하며, 수식·병합·서식 어느 것도 훼손하지 않습니다. Cleanup 패턴으로 오류를 Err.Raise로 드러내며 On Error Resume Next를 사용하지 않아 검수 기준을 모두 충족합니다.
- 위험: 병합 셀 A1:E1의 A1이 아닌 다른 셀(B1~E1)에 Value를 쓰려 하면 1004 오류가 발생할 수 있으나, 이 코드는 A1에만 쓰므로 해당 없음
- 위험: Workbooks("output_청구서_템플릿.xlsx")가 COM 세션에 이미 열려 있지 않으면 subscript out of range(9) 오류 발생 — 단, Python COM 주입 방식에서는 해당 워크북이 열린 상태로 실행되므로 실제 위험도는 낮음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")
    
    ' 병합 셀 A1:E1 의 첫 번째 셀(A1)에 텍스트만 대입
    ' 병합 상태(MergeCells)는 유지되며, 서식도 그대로 보존됩니다.
    ws.Range("A1").Value = "청구 요약(4월)"

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## multiturn_context / separate_unrelated_task — NEEDS_WINDOWS

Prompt:
```text
원가 시트에서 상품별 단가 평균을 구해줘.
```
Warnings:
- Sonnet 검수 RISK: 코드의 전반적인 로직(헤더 탐색 → 배열 읽기 → Dictionary 집계 → 새 시트 출력)은 사용자 의도(원가 시트 상품별 단가 평균)에 부합하며 회사별요약이나 매출 파일을 건드리지 않습니다. 단, wbSrc Is Nothing 체크가 For Each 종료 후 동작하지 않을 수 있는 잠재적 버그가 있고, ActiveWorkbook 의존으로 결과 시트가 의도치 않은 파일에 생성될 가능성이 있어 RISK로 판정합니다.
Needs Windows:
- 마지막 턴이 시나리오 의도대로 동작하는지(분리/개선/전환) 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Scripting.Dictionary usage is allowed.
- Forbidden pattern absent: 회사별요약
- Forbidden pattern absent: \.Range\s*\(\s*[\"']B4
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 아니오 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `상품별단가평균!A1` → 상품
  - `상품별단가평균!B1` → 평균단가
  - `상품별단가평균!A2` → B2B 데이터(5G)
  - `상품별단가평균!B2` → (ABC통신의 B2B 데이터(5G) 단가 합산 / 해당 상품 행 수 — 예: 90000이 여러 행이면 평균)
  - `상품별단가평균!A3` → B2B 음성
  - `상품별단가평균!B3` → (B2B 음성 단가 평균)
  - `회사별요약!B4` → (변경 없음)
  - `회사별요약!D4` → =B4-C4 (수식 보존)
- 근거: 코드의 전반적인 로직(헤더 탐색 → 배열 읽기 → Dictionary 집계 → 새 시트 출력)은 사용자 의도(원가 시트 상품별 단가 평균)에 부합하며 회사별요약이나 매출 파일을 건드리지 않습니다. 단, wbSrc Is Nothing 체크가 For Each 종료 후 동작하지 않을 수 있는 잠재적 버그가 있고, ActiveWorkbook 의존으로 결과 시트가 의도치 않은 파일에 생성될 가능성이 있어 RISK로 판정합니다.
- 위험: wbSrc Is Nothing 검사 로직 버그: For Each 루프가 아무 워크북도 매칭하지 못한 채 완료되면 wbSrc는 Nothing이 아닌 마지막 순회 워크북을 가리킬 수 있어 오류 Raise가 건너뛰어질 위험이 있음
- 위험: ActiveWorkbook이 출력 대상 파일(output_v058_regression_target.xlsx)이 아닌 다른 파일일 경우, 의도하지 않은 워크북에 '상품별단가평균' 시트가 생성될 수 있음
- 위험: 입력 파일(input_원가_2026_4월.xlsx)이 COM 환경에서 열려 있지 않으면 Subscript Out of Range(9) 또는 사용자 정의 오류 발생
- 수정 필요: wbSrc Is Nothing 대신 Boolean found 플래그로 파일 미발견 여부를 판별하도록 수정
- 수정 필요: 결과 시트를 생성할 목적 워크북을 ActiveWorkbook 대신 명시적으로 지정하거나, 최소한 워크북 이름을 로그에 남겨 엉뚱한 파일에 쓰이지 않도록 안전장치 추가

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드에서 `If wbSrc Is Nothing` 체크가 루프 직후에 오지만, 루프가 정상 종료(파일 미발견)된 경우 wbSrc는 Nothing이 아니라 마지막으로 순회한 Workbook 객체일 수 있어 미발견 오류를 놓칠 수 있습니다. 개선안은 별도 Boolean found 플래그를 사용하여 이 버그를 명확히 해소했습니다. 또한 행 수(row count)를 검증 지표로 추가 출력하고 평균단가에 숫자 서식을 지정하여 결과 가독성을 높였습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 입력 파일 찾기
    Dim wbSrc As Workbook
    Dim found As Boolean: found = False
    For Each wbSrc In Application.Workbooks
        If wbSrc.Name = "input_원가_2026_4월.xlsx" Then
            found = True
            Exit For
        End If
    Next wbSrc
    If Not found Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx'가 열려 있지 않습니다."

    Dim wsSrc As Worksheet
    Set wsSrc = wbSrc.Worksheets("원가")

    ' 2. 헤더 행에서 열 위치 탐색
    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    If lastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "원가 시트에 데이터가 없습니다."

    Dim hdrRow As Long: hdrRow = 1
    Dim prodCol As Long: prodCol = 0
    Dim unitCol As Long: unitCol = 0
    Dim lastHdrCol As Long
    lastHdrCol = wsSrc.Cells(hdrRow, wsSrc.Columns.Count).End(xlToLeft).Column

    Dim c As Long
    For c = 1 To lastHdrCol
        Dim hv As String: hv = Trim(CStr(wsSrc.Cells(hdrRow, c).Value))
        If hv = "상품" Then prodCol = c
        If hv = "단가" Then unitCol = c
    Next c
    If prodCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'상품' 열을 찾지 못했습니다."
    If unitCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'단가' 열을 찾지 못했습니다."

    ' 3. 데이터 읽기
    Dim dataArr As Variant
    dataArr = wsSrc.Range(wsSrc.Cells(hdrRow + 1, 1), wsSrc.Cells(lastRow, lastHdrCol)).Value

    ' 4. 상품별 집계
    Dim dictSum As Object, dictCount As Object
    Set dictSum = CreateObject("Scripting.Dictionary")
    Set dictCount = CreateObject("Scripting.Dictionary")

    Dim r As Long
    For r = 1 To UBound(dataArr, 1)
        Dim prod As String: prod = Trim(CStr(dataArr(r, prodCol)))
        If prod <> "" And IsNumeric(dataArr(r, unitCol)) Then
            Dim pv As Double: pv = CDbl(dataArr(r, unitCol))
            If dictSum.Exists(prod) Then
                dictSum(prod) = dictSum(prod) + pv
                dictCount(prod) = dictCount(prod) + 1
            Else
                dictSum.Add prod, pv
                dictCount.Add prod, 1
            End If
        End If
    Next r

    If dictSum.Count = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "집계할 단가 데이터가 없습니다."

    ' 5. 출력 — 원가 시트 내 결과를 동일 시트 오른쪽 여백에 기록 (또는 새 시트)
    ' 사용자가 대상을 명시하지 않았으므로 원가 시트 옆에 새 시트 생성
    Dim wbDst As Workbook: Set wbDst = ActiveWorkbook

    ' 기존 시트 제거 (중복 방지)
    Dim sh As Worksheet
    For Each sh In wbDst.Worksheets
        If sh.Name = "상품별단가평균" Then
            Application.DisplayAlerts = False
            sh.Delete
            Application.DisplayAlerts = True
            Exit For
        End If
    Next sh

    Dim wsDst As Worksheet
    Set wsDst = wbDst.Worksheets.Add(After:=wbDst.Worksheets(wbDst.Worksheets.Count))
    wsDst.Name = "상품별단가평균"

    ' 헤더
    wsDst.Cells(1, 1).Value = "상품"
    wsDst.Cells(1, 2).Value = "평균단가"
    wsDst.Cells(1, 3).Value = "행수"

    ' 결과 배열
    Dim keys As Variant: keys = dictSum.Keys
    Dim outArr() As Variant
    ReDim outArr(1 To dictSum.Count, 1 To 3)
    Dim i As Long
    For i = 0 To dictSum.Count - 1
        outArr(i + 1, 1) = keys(i)
        outArr(i + 1, 2) = dictSum(keys(i)) / dictCount(keys(i))
        outArr(i + 1, 3) = dictCount(keys(i))
    Next i

    wsDst.Range(wsDst.Cells(2, 1), wsDst.Cells(dictSum.Count + 1, 3)).Value = outArr

    ' 서식
    wsDst.Range("B2:B" & (dictSum.Count + 1)).NumberFormat = "#,##0.00"
    wsDst.Columns("A:C").AutoFit

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 입력 파일 및 시트 참조
    Dim wbSrc As Workbook
    Dim wsSrc As Worksheet
    
    ' 입력 파일 찾기
    For Each wbSrc In Application.Workbooks
        If wbSrc.Name = "input_원가_2026_4월.xlsx" Then Exit For
    Next wbSrc
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx'가 열려 있지 않습니다."
    
    Set wsSrc = wbSrc.Worksheets("원가")

    ' 2. 데이터 범위 확인 및 읽기
    Dim lastRow As Long, lastCol As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    If lastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "입력 파일에 원가 데이터가 없습니다."
    
    ' 헤더 행은 1행으로 가정 (스키마: 헤더 ['회사명', '상품', '단가', '원가'])
    Dim hdrRow As Long: hdrRow = 1
    
    ' 헤더에서 열 번호 찾기
    Dim prodCol As Long, unitPriceCol As Long
    prodCol = 0: unitPriceCol = 0
    Dim c As Long
    For c = 1 To wsSrc.Cells(hdrRow, wsSrc.Columns.Count).End(xlToLeft).Column
        Dim hVal As String
        hVal = Trim(CStr(wsSrc.Cells(hdrRow, c).Value))
        If hVal = "상품" Then prodCol = c
        If hVal = "단가" Then unitPriceCol = c
    Next c
    
    If prodCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'상품' 열을 찾지 못했습니다."
    If unitPriceCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'단가' 열을 찾지 못했습니다."

    ' 데이터 배열 읽기 (헤더 제외)
    Dim dataArr As Variant
    dataArr = wsSrc.Range(wsSrc.Cells(hdrRow + 1, 1), wsSrc.Cells(lastRow, wsSrc.Cells(hdrRow, wsSrc.Columns.Count).End(xlToLeft).Column)).Value
    
    ' 3. Dictionary로 상품별 단가 합계 및 개수 집계
    Dim dictSum As Object, dictCount As Object
    Set dictSum = CreateObject("Scripting.Dictionary")
    Set dictCount = CreateObject("Scripting.Dictionary")
    
    Dim r As Long
    Dim prodName As String
    Dim priceVal As Double
    
    For r = 1 To UBound(dataArr, 1)
        prodName = Trim(CStr(dataArr(r, prodCol)))
        If prodName <> "" Then
            If IsNumeric(dataArr(r, unitPriceCol)) Then
                priceVal = CDbl(dataArr(r, unitPriceCol))
                
                If dictSum.Exists(prodName) Then
                    dictSum(prodName) = dictSum(prodName) + priceVal
                    dictCount(prodName) = dictCount(prodName) + 1
                Else
                    dictSum(prodName) = priceVal
                    dictCount(prodName) = 1
                End If
            End If
        End If
    Next r
    
    If dictSum.Count = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "계산할 단가 데이터가 없습니다."

    ' 4. 결과 출력 (현재 활성 워크북의 새 시트 생성)
    Dim wbDst As Workbook
    Set wbDst = ActiveWorkbook
    
    ' 기존 "상품별단가평균" 시트가 있으면 삭제 (중복 방지)
    Dim sh As Worksheet
    Dim sheetExists As Boolean: sheetExists = False
    For Each sh In wbDst.Worksheets
        If sh.Name = "상품별단가평균" Then
            sheetExists = True
            Exit For
        End If
    Next sh
    
    If sheetExists Then
        Application.DisplayAlerts = False
        wbDst.Worksheets("상품별단가평균").Delete
        Application.DisplayAlerts = True
    End If
    
    Dim wsDst As Worksheet
    Set wsDst = wbDst.Worksheets.Add(After:=wbDst.Worksheets(wbDst.Worksheets.Count))
    wsDst.Name = "상품별단가평균"
    
    ' 헤더 작성
    wsDst.Cells(1, 1).Value = "상품"
    wsDst.Cells(1, 2).Value = "평균단가"
    
    ' 데이터 작성
    Dim keys As Variant
    keys = dictSum.Keys
    Dim outArr() As Variant
    ReDim outArr(1 To dictSum.Count, 1 To 2)
    
    Dim i As Long
    For i = 0 To dictSum.Count - 1
        outArr(i + 1, 1) = keys(i)
        outArr(i + 1, 2) = dictSum(keys(i)) / dictCount(keys(i))
    Next i
    
    wsDst.Range(wsDst.Cells(2, 1), wsDst.Cells(dictSum.Count + 1, 2)).Value = outArr
    
    ' 서식 적용 (필요시)
    wsDst.Columns("A:B").AutoFit

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## multiturn_context / feedback_refines_prior — NEEDS_WINDOWS

Prompt:
```text
방금 채운 매출(B)열이 일부 회사에서 비어 보여. 회사명이 정확히 안 맞아서 그런 것 같으니 공백·괄호를 무시하고 다시 매칭해서 B열을 채워줘.
```
Warnings:
- Sonnet 검수 RISK: 코드는 전체적으로 의도(공백·괄호 정규화 후 B열 매출 재매칭)에 부합하고 D/E열 수식도 보존됩니다. 그러나 dict에 없는 회사에 0을 기입하는 로직이 문제입니다: 사용자 요청은 '일부 비어 있는 것을 채워달라'인데, 매칭 안 된 회사의 B열까지 0으로 덮어버려 기존 값(또는 의도적으로 남겨둔 빈 셀)이 오염됩니다. 또한 합계 행을 마지막 1행만 제외하므로 실제 데이터 마지막 행이 합계 위에 빈 행이 있을 경우 범위가 잘못 산정될 수 있습니다. 수식 보존 자체는 B열에만 값을 쓰므로 D/E열은 안전하나, 위 두 가지 이유로 RISK로 판정합니다.
Needs Windows:
- 마지막 턴이 시나리오 의도대로 동작하는지(분리/개선/전환) 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Scripting.Dictionary usage is allowed.
- Matched 회사별요약 B열 대상 + 회사명 정규화.
- Forbidden pattern absent: \.UsedRange\s*\.\s*Value\s*=
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 아니오
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!B4` → 1435000 (ABC통신 매출 합계 숫자값)
  - `회사별요약!B5` → 198000 (글로벌네트워크 매출 합계 숫자값)
  - `회사별요약!B6~B23` → 0 (dict에 없는 회사는 0으로 덮임)
  - `회사별요약!D4` → =B4-C4 (수식 보존 — B열만 값으로 씀)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 보존)
  - `회사별요약!D24` → =SUM(D4:D23) (합계 수식 보존)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 보존)
- 근거: 코드는 전체적으로 의도(공백·괄호 정규화 후 B열 매출 재매칭)에 부합하고 D/E열 수식도 보존됩니다. 그러나 dict에 없는 회사에 0을 기입하는 로직이 문제입니다: 사용자 요청은 '일부 비어 있는 것을 채워달라'인데, 매칭 안 된 회사의 B열까지 0으로 덮어버려 기존 값(또는 의도적으로 남겨둔 빈 셀)이 오염됩니다. 또한 합계 행을 마지막 1행만 제외하므로 실제 데이터 마지막 행이 합계 위에 빈 행이 있을 경우 범위가 잘못 산정될 수 있습니다. 수식 보존 자체는 B열에만 값을 쓰므로 D/E열은 안전하나, 위 두 가지 이유로 RISK로 판정합니다.
- 위험: 매칭 안 된 회사(outArr에서 0으로 설정)의 B열이 0으로 덮여 기존 값(비어 있던 것 포함)이 0이 됨 — 의도는 '비어 있는 것만 채우기'이나 실제로는 '매칭 실패 행도 0으로 덮음'
- 위험: D/E열 수식은 보존되지만 B열이 0이 되면 =IFERROR(D4/B4,0)에서 마진율이 0으로 연산됨
- 위험: 전각 공백 제거를 리터럴 문자열로 처리하는 부분은 소스 파일 인코딩에 따라 실패 가능
- 위험: actualLastRow에서 합계 행을 마지막 1행만 제외하므로, 복수의 합계/빈 행이 있을 때 데이터 범위가 잘못 산정될 수 있음
- 수정 필요: 매칭되지 않은 회사 행에 0을 쓰지 말고 기존 값을 유지하도록 분기 처리 수정 (outArr(i,1)=0 → 해당 셀 건드리지 않음)
- 수정 필요: 합계 행 제외 로직을 단일 1회 검사가 아닌 역방향 반복 루프로 교체하여 다중 합계/빈 행에 대응

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_핵심 개선점은 두 가지입니다. 첫째, 원본 코드는 매칭되지 않은 회사에 0을 기입하지만 개선안은 기존 값을 그대로 유지합니다(noMatch 누적만). 이는 '일부만 비어 있다'는 상황에서 나머지 행을 0으로 오염시키는 위험을 차단합니다. 둘째, 전각 공백을 Chr(12288)로 명시 처리하여 리터럴 문자열 의존을 제거하고, 합계 행 탐색을 역방향 루프로 확장해 빈 셀이 중간에 있어도 데이터 끝을 정확히 찾도록 개선했습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 워크북 참조
    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim wsSrc As Worksheet, wsDst As Worksheet
    Set wsSrc = wbSrc.Worksheets("매출")
    Set wsDst = wbDst.Worksheets("회사별요약")

    ' 2. 매출 데이터 읽기 및 정규화 키별 합계
    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")

    Dim lastRowSrc As Long
    lastRowSrc = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row

    If lastRowSrc > 1 Then
        Dim srcArr As Variant
        srcArr = wsSrc.Range(wsSrc.Cells(2, 1), wsSrc.Cells(lastRowSrc, 4)).Value
        Dim r As Long
        For r = 1 To UBound(srcArr, 1)
            Dim rawKey As String
            rawKey = CStr(srcArr(r, 1))
            Dim normKey As String
            normKey = NormalizeKey(rawKey)
            If normKey <> "" And IsNumeric(srcArr(r, 4)) Then
                If dict.Exists(normKey) Then
                    dict(normKey) = dict(normKey) + CDbl(srcArr(r, 4))
                Else
                    dict.Add normKey, CDbl(srcArr(r, 4))
                End If
            End If
        Next r
    End If

    If dict.Count = 0 Then
        Err.Raise vbObjectError + 514, "B2BSkill", "매출 시트에서 유효한 데이터를 읽지 못했습니다."
    End If

    ' 3. 헤더 행 위치 및 열 탐색
    Dim hdrRow As Long: hdrRow = 3
    Dim companyCol As Long: companyCol = 0
    Dim salesCol As Long: salesCol = 0
    Dim c As Long
    Dim lastColDst As Long
    lastColDst = wsDst.Cells(hdrRow, wsDst.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastColDst
        Dim hdrVal As String
        hdrVal = Trim(CStr(wsDst.Cells(hdrRow, c).Value))
        If hdrVal = "회사명" Then companyCol = c
        If hdrVal = "매출" Then salesCol = c
    Next c
    If companyCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사명' 열을 찾지 못했습니다."
    If salesCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'매출' 열을 찾지 못했습니다."

    ' 4. 데이터 범위 탐색 (합계 행 제외)
    Dim dataStartRow As Long: dataStartRow = hdrRow + 1
    Dim actualLastRow As Long
    actualLastRow = wsDst.Cells(wsDst.Rows.Count, companyCol).End(xlUp).Row

    ' 합계/총계/평균 행 역방향 제외
    Do While actualLastRow >= dataStartRow
        Dim cellVal As String
        cellVal = Trim(CStr(wsDst.Cells(actualLastRow, companyCol).Value))
        If InStr(cellVal, "합계") > 0 Or InStr(cellVal, "총계") > 0 Or InStr(cellVal, "평균") > 0 Or cellVal = "" Then
            actualLastRow = actualLastRow - 1
        Else
            Exit Do
        End If
    Loop

    If actualLastRow < dataStartRow Then
        Err.Raise vbObjectError + 513, "B2BSkill", "회사별요약 시트에 데이터 행이 없습니다."
    End If

    ' 5. 셀 단위로 매출 값 기입 — D/E열 수식은 건드리지 않음
    Dim changed As Long: changed = 0
    Dim noMatch As String: noMatch = ""
    Dim i As Long
    For i = dataStartRow To actualLastRow
        Dim dstRaw As String
        dstRaw = Trim(CStr(wsDst.Cells(i, companyCol).Value))
        If dstRaw = "" Then GoTo NextRow
        Dim dstNorm As String
        dstNorm = NormalizeKey(dstRaw)
        If dict.Exists(dstNorm) Then
            wsDst.Cells(i, salesCol).Value = dict(dstNorm)
            changed = changed + 1
        Else
            ' 매칭 안 된 회사는 건드리지 않음 (기존 값 유지)
            noMatch = noMatch & dstRaw & ", "
        End If
NextRow:
    Next i

    If changed = 0 Then
        Err.Raise vbObjectError + 514, "B2BSkill", "정규화 매칭에도 일치하는 회사가 없습니다. 원천: " & Join(dict.Keys, ",")
    End If

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub

Function NormalizeKey(ByVal txt As String) As String
    Dim s As String
    s = txt
    s = Replace(s, " ", "")
    s = Replace(s, Chr(12288), "") ' 전각 공백
    ' 괄호 및 내용 제거 (반각)
    Dim found As Boolean
    Do
        found = False
        Dim p1 As Long, p2 As Long
        p1 = InStr(s, "(")
        If p1 > 0 Then
            p2 = InStr(p1, s, ")")
            If p2 > p1 Then
                s = Left(s, p1 - 1) & Mid(s, p2 + 1)
            Else
                s = Left(s, p1 - 1) & Mid(s, p1 + 1)
            End If
            found = True
        End If
    Loop While found
    Do
        found = False
        Dim q1 As Long, q2 As Long
        q1 = InStr(s, Chr(65288)) ' 전각 (
        If q1 > 0 Then
            q2 = InStr(q1, s, Chr(65289)) ' 전각 )
            If q2 > q1 Then
                s = Left(s, q1 - 1) & Mid(s, q2 + 1)
            Else
                s = Left(s, q1 - 1) & Mid(s, q1 + 1)
            End If
            found = True
        End If
    Loop While found
    NormalizeKey = Trim(s)
End Function
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 워크북 참조
    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wb As Workbook
    
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim wsSrc As Worksheet, wsDst As Worksheet
    Set wsSrc = wbSrc.Worksheets("매출")
    Set wsDst = wbDst.Worksheets("회사별요약")

    ' 2. 매출 데이터 읽기 및 정규화 키별 합계 계산
    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")
    
    Dim lastRowSrc As Long
    lastRowSrc = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    
    Dim srcArr As Variant
    If lastRowSrc > 1 Then
        srcArr = wsSrc.Range(wsSrc.Cells(2, 1), wsSrc.Cells(lastRowSrc, 4)).Value
    Else
        ReDim srcArr(1 To 1, 1 To 4)
    End If
    
    Dim r As Long
    Dim rawKey As String
    Dim normKey As String
    Dim amount As Double
    
    If UBound(srcArr, 1) >= 1 Then
        For r = 1 To UBound(srcArr, 1)
            rawKey = CStr(srcArr(r, 1))
            normKey = NormalizeKey(rawKey)
            
            If normKey <> "" Then
                If IsNumeric(srcArr(r, 4)) Then
                    amount = CDbl(srcArr(r, 4))
                Else
                    amount = 0
                End If
                
                If dict.Exists(normKey) Then
                    dict(normKey) = dict(normKey) + amount
                Else
                    dict(normKey) = amount
                End If
            End If
        Next r
    End If

    ' 3. 대상 시트(회사별요약) 설정
    Dim hdrRow As Long: hdrRow = 3
    Dim companyCol As Long: companyCol = 0
    Dim salesCol As Long: salesCol = 0
    Dim c As Long
    Dim lastColDst As Long
    
    lastColDst = wsDst.Cells(hdrRow, wsDst.Columns.Count).End(xlToLeft).Column
    
    For c = 1 To lastColDst
        If Trim(CStr(wsDst.Cells(hdrRow, c).Value)) = "회사명" Then companyCol = c
        If Trim(CStr(wsDst.Cells(hdrRow, c).Value)) = "매출" Then salesCol = c
    Next c
    
    If companyCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사명' 열을 찾지 못했습니다."
    If salesCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'매출' 열을 찾지 못했습니다."

    Dim dataStartRow As Long: dataStartRow = hdrRow + 1
    Dim actualLastRow As Long
    
    actualLastRow = wsDst.Cells(wsDst.Rows.Count, companyCol).End(xlUp).Row
    
    ' 합계/요약 행 제외
    Dim lastCellVal As String
    lastCellVal = Trim(CStr(wsDst.Cells(actualLastRow, companyCol).Value))
    If InStr(lastCellVal, "합계") > 0 Or InStr(lastCellVal, "총계") > 0 Or InStr(lastCellVal, "평균") > 0 Then
        actualLastRow = actualLastRow - 1
    End If
    
    If actualLastRow < dataStartRow Then
        Err.Raise vbObjectError + 513, "B2BSkill", "회사별요약 시트에 데이터 행이 없습니다."
    End If
    
    Dim targetRng As Range
    Set targetRng = wsDst.Range(wsDst.Cells(dataStartRow, salesCol), wsDst.Cells(actualLastRow, salesCol))
    
    Dim outArr() As Variant
    ReDim outArr(1 To targetRng.Rows.Count, 1 To 1)
    
    Dim i As Long
    Dim dstRawKey As String
    Dim dstNormKey As String
    Dim changed As Long: changed = 0
    
    For i = 1 To UBound(outArr, 1)
        dstRawKey = CStr(wsDst.Cells(dataStartRow + i - 1, companyCol).Value)
        dstNormKey = NormalizeKey(dstRawKey)
        
        If dict.Exists(dstNormKey) Then
            outArr(i, 1) = dict(dstNormKey)
            changed = changed + 1
        Else
            outArr(i, 1) = 0
        End If
    Next i
    
    targetRng.Value = outArr
    
    If changed = 0 Then
        If dict.Count > 0 Then
             Err.Raise vbObjectError + 514, "B2BSkill", "정규화 매칭에도 일치하는 회사가 없습니다."
        End If
    End If

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub

' 정규화 함수: 공백 제거, 괄호 및 내용 제거, 전각/반각 통일
Function NormalizeKey(ByVal txt As String) As String
    Dim s As String
    s = CStr(txt)
    
    ' 공백 제거
    s = Replace(s, " ", "")
    s = Replace(s, " ", "") ' 전각 공백
    
    ' 괄호 및 괄호 안 내용 제거 (반각, 전각)
    ' 단순화된 접근: 괄호 문자 자체만 제거하거나, 괄호 패턴 제거
    ' 여기서는 괄호 문자와 그 안의 내용을 제거하기 위해 반복 제거 사용
    Dim found As Boolean
    Do
        found = False
        If InStr(s, "(") > 0 Then
            Dim startIdx As Long, endIdx As Long
            startIdx = InStr(s, "(")
            endIdx = InStr(startIdx, s, ")")
            If endIdx > startIdx Then
                s = Left(s, startIdx - 1) & Mid(s, endIdx + 1)
                found = True
            Else
                s = Replace(s, "(", "")
                found = True
            End If
        End If
        If InStr(s, "（") > 0 Then
            Dim startIdx2 As Long, endIdx2 As Long
            startIdx2 = InStr(s, "（")
            endIdx2 = InStr(startIdx2, s, "）")
            If endIdx2 > startIdx2 Then
                s = Left(s, startIdx2 - 1) & Mid(s, endIdx2 + 1)
                found = True
            Else
                s = Replace(s, "（", "")
                found = True
            End If
        End If
    Loop While found
    
    ' 나머지 괄호 문자 제거
    s = Replace(s, "(", "")
    s = Replace(s, ")", "")
    s = Replace(s, "（", "")
    s = Replace(s, "）", "")
    
    NormalizeKey = Trim(s)
End Function
```

Attempts:
- 0: NEEDS_WINDOWS

## multiturn_context / report_failure_then_do_next — NEEDS_WINDOWS

Prompt:
```text
그건 됐고, 원가 시트에서 회사별 원가 합계를 회사별요약 원가(C)열에 채워줘.
```
Warnings:
- Sonnet 검수 RISK: 코드는 전반적으로 의도(원가 시트 집계 → 회사별요약 C열 기재)에 부합하고, D/E열 수식(마진/마진율)과 D24/E24 합계 수식은 건드리지 않아 보존됩니다. 다만 매칭 실패 회사에 0을 기계적으로 채우는 로직이 기존 데이터를 오염시킬 수 있고, Dictionary의 대소문자 구분 기본값이 회사명 미매칭을 유발할 수 있어 RISK로 판정합니다. 직전 '당월매출(통합)' 작업 관련 코드는 포함되어 있지 않아 멀티턴 분리 요건은 충족합니다.
Needs Windows:
- 마지막 턴이 시나리오 의도대로 동작하는지(분리/개선/전환) 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Scripting.Dictionary usage is allowed.
- Forbidden pattern absent: 당월매출
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 아니오
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!C4` → ABC통신의 원가 합계 숫자값 (예: 84718 등 D열 합계)
  - `회사별요약!C5` → 글로벌네트워크의 원가 합계 숫자값
  - `회사별요약!C6~C23` → 매칭된 회사는 합계값, 미매칭 회사는 0 (수식 아닌 값으로 덮어씀)
  - `회사별요약!D4` → =B4-C4 (수식 유지 — C4에 값이 채워졌으므로 마진 자동 재계산됨)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 유지)
  - `회사별요약!D24` → =SUM(D4:D23) (수식 유지)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 유지)
- 근거: 코드는 전반적으로 의도(원가 시트 집계 → 회사별요약 C열 기재)에 부합하고, D/E열 수식(마진/마진율)과 D24/E24 합계 수식은 건드리지 않아 보존됩니다. 다만 매칭 실패 회사에 0을 기계적으로 채우는 로직이 기존 데이터를 오염시킬 수 있고, Dictionary의 대소문자 구분 기본값이 회사명 미매칭을 유발할 수 있어 RISK로 판정합니다. 직전 '당월매출(통합)' 작업 관련 코드는 포함되어 있지 않아 멀티턴 분리 요건은 충족합니다.
- 위험: 미매칭 회사(회사별요약에는 있으나 원가 시트에 없는 회사)의 C열이 0으로 덮여 기존 값이 손실될 수 있음
- 위험: 합계행(24행) 탐지가 A열 값 기준 단순 체크이므로 합계 라벨이 다른 형태(예: '소계', '전체')일 경우 합계 셀에 0이 쓰일 위험
- 위험: 배열 한 번에 쓰기(targetRng.Value = outArr)이므로 병합 셀이 C열에 존재할 경우 1004 오류 가능성
- 위험: Dictionary 기본 CompareMode가 Binary(대소문자 구분)이므로 회사명 표기 불일치 시 매칭 실패 가능
- 수정 필요: 미매칭 회사에 대해 0을 쓰지 않고 기존 값을 유지하도록 수정(Else 분기 제거 또는 건너뜀)
- 수정 필요: Dictionary CompareMode를 vbTextCompare(1)로 설정하여 대소문자 무시 매칭 적용

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 미매칭 회사를 0으로 덮어쓰는 문제가 있어 기존에 수동 입력된 값이 사라질 수 있습니다. 개선안은 매칭된 회사만 값을 씁니다. 또한 Dictionary의 CompareMode를 vbTextCompare(1)로 설정해 회사명 대소문자/공백 불일치로 인한 미매칭 위험을 줄였습니다. 합계 라벨 탐지도 Do-While 루프로 강화하여 복수의 합계/총계/평균 행이 있어도 안전하게 처리합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 소스/대상 워크북·시트 참조
    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook

    For Each wb In Application.Workbooks
        If wb.Name = "input_원가_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx' 가 열려 있지 않습니다."

    On Error Resume Next
    Set wsSrc = wbSrc.Worksheets("원가")
    On Error GoTo Cleanup
    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 시트를 찾지 못했습니다."

    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    On Error Resume Next
    Set wsDst = wbDst.Worksheets("회사별요약")
    On Error GoTo Cleanup
    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."

    ' 2. 원가 시트 → Dictionary 집계 (A=회사명, D=원가)
    Dim dictCost As Object
    Set dictCost = CreateObject("Scripting.Dictionary")
    dictCost.CompareMode = 1 ' vbTextCompare: 대소문자 무시

    Dim srcLastRow As Long
    srcLastRow = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    If srcLastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "원가 시트에 데이터가 없습니다."

    Dim srcArr As Variant
    srcArr = wsSrc.Range(wsSrc.Cells(2, 1), wsSrc.Cells(srcLastRow, 4)).Value

    Dim r As Long
    For r = 1 To UBound(srcArr, 1)
        Dim cName As String
        cName = Trim(CStr(srcArr(r, 1)))
        If cName <> "" Then
            Dim cv As Double
            cv = IIf(IsNumeric(srcArr(r, 4)), CDbl(srcArr(r, 4)), 0)
            If dictCost.Exists(cName) Then
                dictCost(cName) = dictCost(cName) + cv
            Else
                dictCost.Add cName, cv
            End If
        End If
    Next r

    ' 3. 회사별요약 헤더 행에서 열 번호 동적 탐색
    Dim HDR_ROW As Long: HDR_ROW = 3
    Dim colComp As Long, colCost As Long
    colComp = 0: colCost = 0
    Dim lastHdrC As Long
    lastHdrC = wsDst.Cells(HDR_ROW, wsDst.Columns.Count).End(xlToLeft).Column
    Dim c As Long
    For c = 1 To lastHdrC
        Dim hv As String: hv = Trim(CStr(wsDst.Cells(HDR_ROW, c).Value))
        If hv = "회사명" Then colComp = c
        If hv = "원가" Then colCost = c
    Next c
    If colComp = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사명' 헤더를 찾지 못했습니다."
    If colCost = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 헤더를 찾지 못했습니다."

    ' 4. 데이터 행 범위 결정: 헤더+1 ~ 마지막 데이터 행(합계행 제외)
    '    A열 기준으로 마지막 row를 구하되, 합계/빈 셀 행은 쓰지 않음
    Dim DATA_START As Long: DATA_START = HDR_ROW + 1
    Dim DATA_END As Long
    ' A열 마지막 유효 행 탐색 (위에서 아래로 순회하여 합계 라벨 제외)
    Dim rawLast As Long
    rawLast = wsDst.Cells(wsDst.Rows.Count, colComp).End(xlUp).Row
    ' 마지막 행이 합계/총계/빈 셀이면 한 행 위로
    Do While rawLast >= DATA_START
        Dim testVal As String
        testVal = Trim(CStr(wsDst.Cells(rawLast, colComp).Value))
        If testVal = "" Or InStr(testVal, "합계") > 0 Or InStr(testVal, "총계") > 0 Or InStr(testVal, "평균") > 0 Then
            rawLast = rawLast - 1
        Else
            Exit Do
        End If
    Loop
    DATA_END = rawLast
    If DATA_END < DATA_START Then Err.Raise vbObjectError + 513, "B2BSkill", "회사별요약에 데이터 행이 없습니다."

    ' 5. 셀 단위로 원가 값 쓰기 (배열 한번에 쓰되, 미매칭 회사는 기존 값 유지)
    Dim changed As Long: changed = 0
    Dim i As Long
    For i = DATA_START To DATA_END
        Dim dComp As String
        dComp = Trim(CStr(wsDst.Cells(i, colComp).Value))
        If dComp <> "" And dictCost.Exists(dComp) Then
            wsDst.Cells(i, colCost).Value = dictCost(dComp)
            changed = changed + 1
        End If
        ' 미매칭 회사: 기존 값 그대로 유지 (0으로 덮지 않음)
    Next i

    If changed = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다(매칭된 회사가 없음)."

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 대상 워크북 및 시트 설정
    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    
    ' 원가 파일 찾기
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_원가_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_원가_2026_4월.xlsx' 가 열려 있지 않습니다."
    
    ' 원가 시트 찾기
    Dim sh As Worksheet
    For Each sh In wbSrc.Worksheets
        If sh.Name = "원가" Then Set wsSrc = sh: Exit For
    Next sh
    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 시트를 찾지 못했습니다."

    ' 출력 파일 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    ' 회사별요약 시트 찾기
    For Each sh In wbDst.Worksheets
        If sh.Name = "회사별요약" Then Set wsDst = sh: Exit For
    Next sh
    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사별요약' 시트를 찾지 못했습니다."

    ' 2. 원가 데이터 읽기 및 합계 계산 (Dictionary 사용)
    Dim dictCost As Object
    Set dictCost = CreateObject("Scripting.Dictionary")
    
    Dim srcLastRow As Long, srcLastCol As Long
    srcLastRow = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    If srcLastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "원가 시트에 데이터가 없습니다."
    
    ' 원가 시트 데이터 배열 읽기 (회사명: A열, 원가: D열)
    Dim srcArr As Variant
    srcArr = wsSrc.Range(wsSrc.Cells(2, 1), wsSrc.Cells(srcLastRow, 4)).Value
    
    Dim r As Long
    For r = 1 To UBound(srcArr, 1)
        Dim companyName As String
        companyName = Trim(CStr(srcArr(r, 1)))
        If companyName <> "" Then
            Dim costVal As Double
            If IsNumeric(srcArr(r, 4)) Then
                costVal = CDbl(srcArr(r, 4))
            Else
                costVal = 0
            End If
            
            If dictCost.Exists(companyName) Then
                dictCost(companyName) = dictCost(companyName) + costVal
            Else
                dictCost.Add companyName, costVal
            End If
        End If
    Next r

    ' 3. 회사별요약 시트에 원가 채우기
    Dim dstHdrRow As Long: dstHdrRow = 3 ' 스키마에 따르면 헤더는 3행
    Dim dstLastRow As Long
    dstLastRow = wsDst.Cells(wsDst.Rows.Count, 1).End(xlUp).Row
    
    ' 합계행 제외 확인 (마지막 행이 합계 수식인지 확인)
    ' 스키마에 따르면 D24, E24에 합계/평균 수식이 있음. 데이터는 4~23행까지.
    ' 회사명(A열)이 비어있거나 합계 라벨이 있으면 제외해야 함.
    ' 여기서는 A열이 비어있으면 데이터 끝으로 간주하거나, 명시된 마지막 행까지 루프.
    ' 스키마: 행 4~23이 데이터, 행 24가 합계.
    If dstLastRow > dstHdrRow Then
        ' 마지막 행이 합계 행일 가능성이 높으므로, A열 값이 비어있거나 "합계" 등일 경우 제외
        Dim checkVal As Variant
        checkVal = wsDst.Cells(dstLastRow, 1).Value
        If IsEmpty(checkVal) Or checkVal = "" Or InStr(CStr(checkVal), "합계") > 0 Or InStr(CStr(checkVal), "총계") > 0 Then
            dstLastRow = dstLastRow - 1
        End If
    End If
    
    If dstLastRow < dstHdrRow + 1 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "회사별요약 시트에 채울 데이터 행이 없습니다."
    End If

    ' 회사명 열(A)과 원가 열(C)의 열 번호 확인
    Dim colCompany As Long, colCost As Long
    colCompany = 0: colCost = 0
    Dim c As Long
    Dim lastC As Long: lastC = wsDst.Cells(dstHdrRow, wsDst.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastC
        If Trim(CStr(wsDst.Cells(dstHdrRow, c).Value)) = "회사명" Then colCompany = c
        If Trim(CStr(wsDst.Cells(dstHdrRow, c).Value)) = "원가" Then colCost = c
    Next c
    
    If colCompany = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'회사명' 헤더를 찾지 못했습니다."
    If colCost = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'원가' 헤더를 찾지 못했습니다."

    ' 원가 값 채우기
    Dim changed As Long: changed = 0
    Dim outArr() As Variant
    ReDim outArr(1 To dstLastRow - dstHdrRow, 1 To 1)
    
    Dim i As Long
    For i = 1 To dstLastRow - dstHdrRow
        Dim dstRow As Long: dstRow = dstHdrRow + i
        Dim dstCompany As String
        dstCompany = Trim(CStr(wsDst.Cells(dstRow, colCompany).Value))
        
        If dictCost.Exists(dstCompany) Then
            outArr(i, 1) = dictCost(dstCompany)
            changed = changed + 1
        Else
            outArr(i, 1) = 0 ' 매칭 안 되면 0
        End If
    Next i
    
    ' 원가 열(C)에 값 쓰기
    Dim targetRng As Range
    Set targetRng = wsDst.Range(wsDst.Cells(dstHdrRow + 1, colCost), wsDst.Cells(dstLastRow, colCost))
    targetRng.Value = outArr

    If changed = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다(매칭된 회사가 없음)."

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## no_residual_previous_work / new_request_only — NEEDS_WINDOWS

Prompt:
```text
이전 작업은 이미 적용돼 있어. 이번에는 월별실적 B4에 '1077'이라고만 써줘. 이전 작업을 다시 하거나 지우지 마.
```
Needs Windows:
- 이번 요청 외 과거 작업(초기화/삭제)이 섞이지 않았는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: Step\s*1
- Forbidden pattern absent: 이전\s*단계
- Forbidden pattern absent: \.UsedRange\s*\.\s*Clear
- Forbidden pattern absent: \.Cells\s*\.\s*Clear
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No all-worksheet loop for single-sheet request.
- No destructive clear/delete detected.
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 1077
  - `월별실적!D5` → =C5-C4
  - `월별실적!D6` → =C6-C5
  - `월별실적!D7` → =C7-C6
- 근거: 코드는 output_청구서_템플릿.xlsx의 '월별실적' 시트 B4(4행 2열)에 1077을 값으로 쓰는 단일 작업만 수행한다. 이전 작업에 대한 재실행이나 초기화 코드가 없고, 다른 셀/시트를 건드리지 않는다. 월별실적 시트의 D열 수식(D5~D7)도 보존된다. On Error GoTo Cleanup 후 raisedNum 패턴으로 에러를 재raise하므로 조용한 실패도 없다. 기대 결과와 완전히 일치한다.
- 위험: output_청구서_템플릿.xlsx 가 COM 세션에서 열려 있지 않으면 vbObjectError+515 로 실패하나, 이는 정상적인 에러 처리이므로 문제 없음
- 위험: B4는 스키마상 수식이 없는 빈 셀이므로 수식 파괴 위험 없음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbDst.Worksheets("월별실적")

    ws.Cells(4, 2).Value = 1077

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## no_residual_previous_work / replace_deleted_logic — NEEDS_WINDOWS

Prompt:
```text
기존 스킬을 삭제한 뒤 새로 요청하는 작업이야. 회사별요약 시트의 매출(B)열만 비워줘. 예전 작업 내용은 반복하지 마.
```
Warnings:
- Sonnet 검수 RISK: 코드의 의도(B열 매출 데이터 비우기, 마진/마진율 수식 보존, 합계행 제외)는 올바르나, B열이 이미 비어 있으면 End(xlUp) 탐색이 헤더행 이하 행을 반환해 Err.Raise로 실패하는 구조적 취약점이 있습니다. 또한 lastRow-1 로직으로 실제 데이터 마지막 행(23행)이 비워지지 않을 수 있어 scope_correct가 부분 불일치합니다. D/E열 수식은 .Value 대입 범위 밖이므로 보존되며, 이 점은 expected와 일치합니다.
Needs Windows:
- 이번 요청 외 과거 작업(초기화/삭제)이 섞이지 않았는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: Step\s*1
- Forbidden pattern absent: 이전\s*단계
- Forbidden pattern absent: \.UsedRange\s*\.\s*Clear
- Forbidden pattern absent: \.Cells\s*\.\s*Clear
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No all-worksheet loop for single-sheet request.
- No destructive clear/delete detected.
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 아니오 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!B4` → "" (빈값으로 지워짐)
  - `회사별요약!B5` → "" (빈값으로 지워짐)
  - `회사별요약!B23` → (lastRow-1 로직에 따라 비워질 수도 있으나 아래 참조)
  - `회사별요약!B24` → (SUM 수식 등 합계행 여부 불분명 — lastRow-1 제외 로직)
  - `회사별요약!D4` → =B4-C4 (수식 그대로 보존)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 그대로 보존)
  - `회사별요약!D24` → =SUM(D4:D23) (수식 그대로 보존)
  - `회사별요약!E24` → =AVERAGE(E4:E23) (수식 그대로 보존)
- 근거: 코드의 의도(B열 매출 데이터 비우기, 마진/마진율 수식 보존, 합계행 제외)는 올바르나, B열이 이미 비어 있으면 End(xlUp) 탐색이 헤더행 이하 행을 반환해 Err.Raise로 실패하는 구조적 취약점이 있습니다. 또한 lastRow-1 로직으로 실제 데이터 마지막 행(23행)이 비워지지 않을 수 있어 scope_correct가 부분 불일치합니다. D/E열 수식은 .Value 대입 범위 밖이므로 보존되며, 이 점은 expected와 일치합니다.
- 위험: B열이 이미 비어 있을 경우 End(xlUp)가 헤더행(3행) 이하로 내려가 lastRow <= hdrRow 조건에 걸려 '지울 데이터가 없습니다' 오류 발생 — 즉 B열이 이미 빈 상태이면 no-op가 아니라 Err.Raise로 실패
- 위험: lastRow-1 로직으로 실제 데이터 마지막 행(23행)이 제외될 가능성: 합계행이 24행에 있고 lastRow가 B24를 잡지 못하면 23행 데이터도 함께 누락될 수 있음
- 위험: targetRng.Value = arr 방식은 ClearContents와 달리 빈 문자열("")을 값으로 주입하므로, 해당 셀에 숫자 서식이 걸려 있으면 서식은 유지되나 셀 타입이 텍스트 빈값으로 바뀌어 SUM 참조 계산에 영향 없음(정상)이나 의도보다 부자연스러움
- 위험: B열에 병합셀이 있다면 Range.Value 배열 대입 시 1004 오류 발생 가능
- 수정 필요: B열이 비어 있어도 정상 동작하도록: lastRow 탐색 대신 시트 스키마 기준 고정 범위(4~23행) 사용 또는 A열 기준으로 lastRow 탐색
- 수정 필요: lastRow-1 대신 합계행 행번호를 명시적으로 제외(예: 24행은 고정 제외)하여 23행 데이터 누락 방지
- 수정 필요: targetRng.Value = arr 대신 targetRng.ClearContents 사용으로 서식 보존 및 병합셀 오류 방지

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 lastRow를 B열 마지막 비빈 행으로 탐색한 뒤 lastRow-1까지만 비우는데, B열이 이미 비어 있으면 lastRow가 hdrRow 이하로 내려가 데이터가 있는 행(4~23행)을 전혀 비우지 못하는 no-op 위험이 있습니다. 또한 .Value=arr 방식은 의도치 않게 기존 서식을 유지하나 병합셀이 포함된 경우 1004 오류 가능성이 있습니다. 개선안은 시트 스키마에서 데이터 범위(4~23행)를 명시 고정하고 ClearContents를 직접 호출하여 범위 오탐 없이 안전하게 처리합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbDst.Worksheets("회사별요약")

    Dim hdrRow As Long: hdrRow = 3
    Dim dataStart As Long: dataStart = hdrRow + 1  ' 4행
    Dim dataEnd As Long: dataEnd = 23              ' 합계행(24행) 제외, 데이터 마지막 23행

    ' B(매출)열 데이터 행만 ClearContents — 수식/서식 보존, 합계행(24행) 제외
    Dim targetRng As Range
    Set targetRng = ws.Range(ws.Cells(dataStart, 2), ws.Cells(dataEnd, 2))
    targetRng.ClearContents

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbDst As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbDst.Worksheets("회사별요약")

    Dim hdrRow As Long: hdrRow = 3
    Dim salesCol As Long: salesCol = 2 ' B열
    
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, salesCol).End(xlUp).Row
    
    ' 합계행(마지막 행)은 제외하고 데이터 범위만 처리
    If lastRow <= hdrRow Then
        Err.Raise vbObjectError + 513, "B2BSkill", "지울 데이터가 없습니다."
    End If
    
    Dim targetRng As Range
    Set targetRng = ws.Range(ws.Cells(hdrRow + 1, salesCol), ws.Cells(lastRow - 1, salesCol))
    
    ' 배열을 사용하여 값만 비움 (ClearContents 대체)
    Dim arr As Variant
    arr = targetRng.Value
    
    Dim r As Long
    For r = 1 To UBound(arr, 1)
        arr(r, 1) = ""
    Next r
    
    targetRng.Value = arr

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: FAIL
- 1: NEEDS_WINDOWS

## no_residual_previous_work / do_not_reset_workbook — NEEDS_WINDOWS

Prompt:
```text
이번 요청 하나만 수행해. 워크북 전체 초기화나 기존 결과 삭제 없이, 월별실적 B4의 값만 1077로 바꿔줘.
```
Needs Windows:
- 이번 요청 외 과거 작업(초기화/삭제)이 섞이지 않았는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: Step\s*1
- Forbidden pattern absent: 이전\s*단계
- Forbidden pattern absent: \.UsedRange\s*\.\s*Clear
- Forbidden pattern absent: \.Cells\s*\.\s*Clear
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- No all-worksheet loop for single-sheet request.
- No destructive clear/delete detected.
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 1077
  - `월별실적!D5` → =C5-C4
  - `월별실적!D6` → =C6-C5
  - `월별실적!D7` → =C7-C6
- 근거: VBA는 output_청구서_템플릿.xlsx 워크북의 월별실적 시트 B4 셀에만 1077을 기록하며, 다른 셀·시트·워크북에 대한 Clear나 초기화 코드가 전혀 없다. 수식 셀(D5~D7)은 건드리지 않으므로 그대로 보존된다. 워크북을 For Each로 탐색해 없으면 Err.Raise하는 구조도 적절하며, Cleanup 구간에서 계산 모드·ScreenUpdating 복구 후 에러를 재발생시키는 패턴도 올바르다. 사용자 의도(단일 셀 값 변경, 전체 초기화 없음)와 완전히 일치하여 PASS로 판정한다.
- 위험: 워크북 이름 대소문자·확장자가 실제 열린 파일과 정확히 일치하지 않으면 For Each 루프가 wb를 Nothing으로 남겨 Err.Raise가 발생할 수 있음(확장자 .xlsx vs .xlsm 등 차이 주의)
- 위험: Cleanup 레이블 방식에서 On Error GoTo Cleanup 이후 정상 흐름도 Cleanup으로 낙하하지 않도록 GoTo EndSub 분기가 없으나, Err.Number 체크로 대응하고 있어 실질적 문제는 없음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Exit For
    Next wb
    If wb Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wb.Worksheets("월별실적")

    ws.Cells(4, 2).Value = 1077

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## output_cell_target / selected_cell_here — NEEDS_WINDOWS

Prompt:
```text
선택한 셀 여기에 1월 총 건수를 써줘.

[정확 참조]
- 선택 셀: 파일 "output_청구서_템플릿.xlsx", 시트 "월별실적", 셀 "B4"
```
Needs Windows:
- 월별실적 시트 B4 에만 결과가 들어가고 인접 셀(B5/C4 등)은 불변인지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 월별실적!B4 명시 타깃.
- Forbidden pattern absent: ActiveCell\s*\.\s*Offset
- Forbidden pattern absent: Selection\s*\.\s*Offset
- Forbidden pattern absent: \.Range\s*\(\s*[\"']A1[\"']\s*\)
- Uses explicit A1 output address.
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 1077
  - `월별실적!B5` → (변경 없음)
  - `월별실적!C4` → (변경 없음)
  - `월별실적!D5` → =C5-C4 (수식 보존)
- 근거: 코드는 output_청구서_템플릿.xlsx의 월별실적 시트 B4 셀에만 정확히 값을 씁니다. wsDst.Cells(4, 2).Value = janCount로 B4만 수정하며 다른 셀(D5 등 수식 셀)은 전혀 건드리지 않아 수식이 보존됩니다. input_매출_2026_4월.xlsx의 월별집계 시트 행3에 '1월' 건수 1077이 존재하므로 B4에 1077이 정상 입력됩니다. COM 런타임 오류 발생 가능성도 낮고, 의도와 범위가 일치합니다.
- 위험: input_매출_2026_4월.xlsx의 월별집계 시트에는 ■ 상반기, ■ 하반기, ■ 분기별 요약 등 3개 표가 존재하며 '1월' 행이 여러 번 나타날 수 있음. 현재 코드는 첫 번째 '1월'을 Exit For로 취하므로 중복 시 상반기 1월 값(1077)을 올바르게 사용하지만, 하반기 표에도 '1월'이 있을 경우 혼동 가능성이 잠재적으로 존재함
- 위험: On Error GoTo Cleanup 구조에서 Cleanup 레이블 도달 시 Err.Number가 0이 아닌 경우만 저장하는 로직인데, Cleanup 전에 정상 흐름도 해당 레이블을 통과하므로 동작에는 문제없지만 가독성이 낮음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook
    
    ' 소스 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    
    ' 대상 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    
    Set wsSrc = wbSrc.Worksheets("월별집계")
    Set wsDst = wbDst.Worksheets("월별실적")
    
    ' 소스 시트에서 헤더 행 확인 (스키마에 따르면 행 2)
    Dim srcHdrRow As Long: srcHdrRow = 2
    Dim lastRowSrc As Long
    lastRowSrc = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    
    ' 헤더 열 위치 찾기 (월, 건수, 금액)
    Dim colMonth As Long, colCount As Long
    colMonth = 0: colCount = 0
    Dim c As Long
    Dim lastColSrc As Long
    lastColSrc = wsSrc.Cells(srcHdrRow, wsSrc.Columns.Count).End(xlToLeft).Column
    
    For c = 1 To lastColSrc
        If Trim(CStr(wsSrc.Cells(srcHdrRow, c).Value)) = "월" Then colMonth = c
        If Trim(CStr(wsSrc.Cells(srcHdrRow, c).Value)) = "건수" Then colCount = c
    Next c
    
    If colMonth = 0 Or colCount = 0 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "소스 시트에서 '월' 또는 '건수' 헤더를 찾지 못했습니다."
    End If
    
    ' 1월 데이터 찾기
    Dim janCount As Variant
    janCount = 0
    Dim found As Boolean: found = False
    Dim r As Long
    For r = srcHdrRow + 1 To lastRowSrc
        If Trim(CStr(wsSrc.Cells(r, colMonth).Value)) = "1월" Then
            janCount = wsSrc.Cells(r, colCount).Value
            found = True
            Exit For
        End If
    Next r
    
    If Not found Then
        Err.Raise vbObjectError + 513, "B2BSkill", "소스 시트에서 '1월' 데이터를 찾지 못했습니다."
    End If
    
    ' 대상 셀에 값 입력
    wsDst.Cells(4, 2).Value = janCount ' B4

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## output_cell_target / explicit_sheet_address — NEEDS_WINDOWS

Prompt:
```text
output_청구서_템플릿.xlsx 파일의 월별실적 시트 B4 셀에 1월 건수 합계를 출력해줘. 다른 셀은 건드리지 마.
```
Warnings:
- Sonnet 검수 RISK: 코드는 의도한 셀(월별실적!B4)에만 값을 쓰고 다른 셀(D5~D7 수식 등)을 건드리지 않으므로 범위 및 수식 보존 측면은 정확합니다. 다만 월별집계 시트에 동일 월명 행이 여러 개 존재할 수 있는 구조(3개 표)임에도 첫 번째 매칭에서 Exit For로 중단하는 로직이 부분 값 반영 위험을 내포하며, 데이터 미존재 시 0을 조용히 기입하는 무음 오보 가능성도 있어 RISK로 판정합니다.
Needs Windows:
- 월별실적 시트 B4 에만 결과가 들어가고 인접 셀(B5/C4 등)은 불변인지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 월별실적!B4 명시 타깃.
- Forbidden pattern absent: ActiveCell\s*\.\s*Offset
- Forbidden pattern absent: Selection\s*\.\s*Offset
- Forbidden pattern absent: \.Range\s*\(\s*[\"']A1[\"']\s*\)
- Uses explicit A1 output address.
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 1077
  - `월별실적!D5` → =C5-C4
  - `월별실적!D6` → =C6-C5
  - `월별실적!D7` → =C7-C6
  - `월별실적!B5` → (변경 없음)
  - `월별실적!C4` → (변경 없음)
- 근거: 코드는 의도한 셀(월별실적!B4)에만 값을 쓰고 다른 셀(D5~D7 수식 등)을 건드리지 않으므로 범위 및 수식 보존 측면은 정확합니다. 다만 월별집계 시트에 동일 월명 행이 여러 개 존재할 수 있는 구조(3개 표)임에도 첫 번째 매칭에서 Exit For로 중단하는 로직이 부분 값 반영 위험을 내포하며, 데이터 미존재 시 0을 조용히 기입하는 무음 오보 가능성도 있어 RISK로 판정합니다.
- 위험: 월별집계 시트에는 ■상반기/■하반기/■분기별 3개 표가 존재하며 '1월' 헤더명이 여러 행에 반복될 수 있음. 현재 코드는 Exit For로 첫 번째 발견값만 취하므로 의도치 않게 부분 값만 반영될 수 있음
- 위험: janCount = 0 초기화 후 데이터가 없어도 에러 없이 0을 B4에 기입하며 조용히 종료됨(무음 no-op에 가까운 오보 위험)
- 위험: 스키마 상 월별집계 행3에 '1월' 건수 1077이 존재하므로 실제 실행 시 첫 Exit For 경로가 올바른 값(1077)을 반환할 가능성이 높으나, 구조적 보장은 없음
- 수정 필요: Exit For 제거 후 모든 '1월' 행 건수를 누적 합산하도록 수정
- 수정 필요: 1월 데이터를 찾지 못했을 때 0 입력 대신 Err.Raise로 명시적 오류 발생

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 '1월' 행을 첫 번째 발견 즉시 Exit For로 종료하므로, 월별집계 시트처럼 표가 여러 개(상반기/하반기/분기별)로 나뉘어 '1월'이 중복 등장할 경우 첫 번째 값만 가져오게 됩니다. 개선안은 모든 '1월' 행의 건수를 누적 합산(Sum)하고, 한 건도 못 찾으면 에러를 발생시켜 '0이 기입됐는데 사실은 데이터 없음'인 무음 오보를 방지합니다. 또한 janCount=0 분기에서 아무것도 안 하는 빈 블록을 제거해 코드 의도를 명확히 했습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook

    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    Set wsSrc = Nothing
    Dim sh As Worksheet
    For Each sh In wbSrc.Worksheets
        If sh.Name = "월별집계" Then Set wsSrc = sh: Exit For
    Next sh
    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'월별집계' 시트를 찾지 못했습니다."

    Set wsDst = Nothing
    For Each sh In wbDst.Worksheets
        If sh.Name = "월별실적" Then Set wsDst = sh: Exit For
    Next sh
    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'월별실적' 시트를 찾지 못했습니다."

    ' 소스 헤더 행 위치 확정 (스키마상 행2)
    Dim hdrRow As Long: hdrRow = 2
    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row

    Dim monthCol As Long, countCol As Long
    monthCol = 0: countCol = 0
    Dim c As Long
    Dim lastHdrCol As Long
    lastHdrCol = wsSrc.Cells(hdrRow, wsSrc.Columns.Count).End(xlToLeft).Column
    For c = 1 To lastHdrCol
        Dim hval As String: hval = Trim(CStr(wsSrc.Cells(hdrRow, c).Value))
        If hval = "월" Then monthCol = c
        If hval = "건수" Then countCol = c
    Next c
    If monthCol = 0 Or countCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'월' 또는 '건수' 헤더를 찾지 못했습니다."

    ' 1월 건수 합계 집계 (동일 월명이 여러 행일 수 있으므로 Sum)
    Dim janTotal As Double
    janTotal = 0
    Dim found As Boolean: found = False
    Dim r As Long
    For r = hdrRow + 1 To lastRow
        If Trim(CStr(wsSrc.Cells(r, monthCol).Value)) = "1월" Then
            Dim v As Variant: v = wsSrc.Cells(r, countCol).Value
            If IsNumeric(v) Then janTotal = janTotal + CDbl(v)
            found = True
        End If
    Next r
    If Not found Then Err.Raise vbObjectError + 514, "B2BSkill", "소스 시트에서 '1월' 데이터를 찾지 못했습니다."

    ' 대상 셀(월별실적!B4)에만 값 입력
    wsDst.Cells(4, 2).Value = janTotal

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook

    ' 소스 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    ' 소스 시트 찾기
    Dim sh As Worksheet
    For Each sh In wbSrc.Worksheets
        If sh.Name = "월별집계" Then Set wsSrc = sh: Exit For
    Next sh
    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'월별집계' 시트를 찾지 못했습니다."

    ' 대상 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."

    ' 대상 시트 찾기
    For Each sh In wbDst.Worksheets
        If sh.Name = "월별실적" Then Set wsDst = sh: Exit For
    Next sh
    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'월별실적' 시트를 찾지 못했습니다."

    ' 소스 데이터에서 1월 건수 찾기
    ' 스키마에 따르면 헤더는 행 2에 있음: ['월', '건수', '금액']
    Dim hdrRow As Long: hdrRow = 2
    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 1).End(xlUp).Row
    
    Dim monthCol As Long, countCol As Long
    monthCol = 0: countCol = 0
    Dim c As Long
    For c = 1 To wsSrc.Cells(hdrRow, wsSrc.Columns.Count).End(xlToLeft).Column
        If Trim(CStr(wsSrc.Cells(hdrRow, c).Value)) = "월" Then monthCol = c
        If Trim(CStr(wsSrc.Cells(hdrRow, c).Value)) = "건수" Then countCol = c
    Next c
    
    If monthCol = 0 Or countCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'월' 또는 '건수' 헤더를 찾지 못했습니다."

    Dim janCount As Variant
    janCount = 0
    Dim r As Long
    For r = hdrRow + 1 To lastRow
        If Trim(CStr(wsSrc.Cells(r, monthCol).Value)) = "1월" Then
            janCount = wsSrc.Cells(r, countCol).Value
            Exit For
        End If
    Next r

    If janCount = 0 Then
        ' 1월 데이터가 없거나 0인 경우 처리 (에러가 아닌 0으로 입력)
    End If

    ' 대상 셀에 값 입력
    wsDst.Cells(4, 2).Value = janCount

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## output_cell_target / avoid_nearby_cell — NEEDS_WINDOWS

Prompt:
```text
월별실적 탭의 1월 건수 칸(B4)에만 값을 넣어줘. B5나 C4가 아니라 B4야.
```
Warnings:
- Sonnet 검수 RISK: 코드는 월별실적!B4에만 값을 쓰고 B5, C4 등 인접 셀을 건드리지 않으므로 의도 부합 및 범위 정확성은 만족합니다. D5 수식(=C5-C4) 등 인접 수식도 보존됩니다. 다만 Workbooks() 직접 참조는 COM 환경에서 파일명 불일치 시 Subscript out of range 오류가 발생할 수 있고, 입력값 1000이 하드코딩되어 실제 데이터와 불일치할 위험이 있어 RISK로 판정합니다.
Needs Windows:
- 월별실적 시트 B4 에만 결과가 들어가고 인접 셀(B5/C4 등)은 불변인지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 월별실적!B4 명시 타깃.
- Forbidden pattern absent: ActiveCell\s*\.\s*Offset
- Forbidden pattern absent: Selection\s*\.\s*Offset
- Forbidden pattern absent: \.Range\s*\(\s*[\"']A1[\"']\s*\)
- Uses explicit A1 output address.
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 1000
  - `월별실적!B5` → (변경 없음)
  - `월별실적!C4` → (변경 없음)
  - `월별실적!D5` → =C5-C4 (수식 그대로)
- 근거: 코드는 월별실적!B4에만 값을 쓰고 B5, C4 등 인접 셀을 건드리지 않으므로 의도 부합 및 범위 정확성은 만족합니다. D5 수식(=C5-C4) 등 인접 수식도 보존됩니다. 다만 Workbooks() 직접 참조는 COM 환경에서 파일명 불일치 시 Subscript out of range 오류가 발생할 수 있고, 입력값 1000이 하드코딩되어 실제 데이터와 불일치할 위험이 있어 RISK로 판정합니다.
- 위험: Workbooks("output_청구서_템플릿.xlsx") 직접 참조 시, COM에서 파일명 불일치(대소문자, 경로 포함 여부 등)로 Subscript out of range(9) 오류 발생 가능
- 위험: ws.Range("B4")가 병합 셀에 속할 경우 런타임 1004 오류 가능(스키마상 명시된 병합 없으나 확인 필요)
- 위험: 시트가 보호되어 있으면 값 쓰기 시 1004 오류 발생 가능
- 위험: B4에 입력할 실제 값(1000)이 하드코딩되어 있어, 실제 계산·집계 결과와 다를 수 있음(의도된 값인지 불분명)
- 수정 필요: Workbooks("...") 직접 참조 대신 반복문+InStr로 파일을 탐색하거나, 파일을 찾지 못하면 명시적 오류를 발생시킬 것
- 수정 필요: 입력할 값(1000)이 임의 하드코딩인지 확인하고, 실제 집계값이 필요하다면 소스 셀에서 읽어와야 함

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 Workbooks("output_청구서_템플릿.xlsx")를 직접 참조하는데, COM 환경에서 파일명 대소문자·공백 불일치나 파일이 미열린 경우 Subscript out of range(9) 런타임 오류가 발생할 수 있습니다. 개선안은 파일명 부분 일치(InStr) 방식으로 워크북을 탐색하고, 시트 존재 여부 및 보호·병합 셀 여부를 사전 검사하여 오류 원인을 명확히 드러냅니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    prevCalc = Application.Calculation
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook, ws As Worksheet

    ' 파일이 열려 있는지 확인
    Dim wbFound As Boolean: wbFound = False
    Dim wbItem As Workbook
    For Each wbItem In Workbooks
        If InStr(1, wbItem.Name, "output_청구서_템플릿", vbTextCompare) > 0 Then
            Set wb = wbItem
            wbFound = True
            Exit For
        End If
    Next wbItem
    If Not wbFound Then
        Err.Raise 9, "B2BSkill", "output_청구서_템플릿.xlsx 파일이 열려 있지 않습니다."
    End If

    ' 시트 존재 확인
    Dim wsFound As Boolean: wsFound = False
    Dim wsItem As Worksheet
    For Each wsItem In wb.Worksheets
        If wsItem.Name = "월별실적" Then
            Set ws = wsItem
            wsFound = True
            Exit For
        End If
    Next wsItem
    If Not wsFound Then
        Err.Raise 9, "B2BSkill", "월별실적 시트를 찾을 수 없습니다."
    End If

    ' 시트 보호 여부 확인
    If ws.ProtectContents Then
        Err.Raise 1004, "B2BSkill", "월별실적 시트가 보호되어 있어 B4에 쓸 수 없습니다."
    End If

    ' 병합 여부 확인 (B4가 병합 셀이면 1004 발생 가능)
    If ws.Range("B4").MergeCells Then
        Err.Raise 1004, "B2BSkill", "B4가 병합된 셀입니다. 병합 셀 쓰기에 주의하세요."
    End If

    ' B4에만 값 입력 (B5, C4 등 인접 셀 건드리지 않음)
    ws.Range("B4").Value = 1000

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook, ws As Worksheet
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    Set ws = wb.Worksheets("월별실적")
    
    ' 1월 건수 칸(B4)에 값 입력
    ws.Range("B4").Value = 1000

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## paste_values_only_openpyxl / write_count_total_value — PASS

Prompt:
```text
매출 시트 전체 건수 합계를 '값으로' 월별실적 B4에 적어줘. openpyxl은 수식을 재계산하지 않으니 합계는 직접 계산해서 숫자로 넣어. 수식 말고 값이어야 해.
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B4` → 31139
  - `월별실적!D5` → =C5-C4
  - `월별실적!D6` → =C6-C5
  - `월별실적!D7` → =C7-C6
- 근거: 코드는 사용자가 요청한 대로 input_매출_2026_4월.xlsx의 매출 시트에서 건수 열을 동적으로 찾아 헤더 제외 합계를 계산하고, output_청구서_템플릿.xlsx의 월별실적!B4에 숫자 값으로 기입한다. 기대값 31139와 일치하며, D5~D7의 수식 등 다른 셀은 전혀 건드리지 않아 수식·서식 보존도 충족된다. Workbooks.Open/Save/MsgBox 등 금지 패턴이 없고, 오류 시 Err.Raise로 드러내므로 COM 런타임 환경에서도 안전하게 동작할 것으로 판단된다.
- 위험: 매출 시트 데이터 행이 1200행으로 많아 배열로 읽지만, 건수 열 값이 문자열로 저장된 경우 IsNumeric 통과 후 CDbl 변환 시 일부 누락될 수 있음(단, 스키마상 숫자형이므로 실제 위험 낮음)
- 위험: Cleanup 레이블에서 Err.Number를 raisedNum에 저장 후 다시 Raise하는 패턴은 정상이나, 정상 흐름(오류 없음)에서도 Cleanup으로 GoTo할 때 Err.Number가 이전 오류를 남기는 경우 False positive로 재Raise될 수 있음(실제 발생 가능성은 낮지만 주의)

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 입력 파일 및 시트 참조
    Dim wbSrc As Workbook, wsSrc As Worksheet
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    
    Dim sh As Worksheet
    Set wsSrc = Nothing
    For Each sh In wbSrc.Worksheets
        If sh.Name = "매출" Then Set wsSrc = sh: Exit For
    Next sh
    If wsSrc Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'매출' 시트를 찾지 못했습니다."

    ' 2. 출력 파일 및 시트 참조
    Dim wbDst As Workbook, wsDst As Worksheet
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    
    Set wsDst = Nothing
    For Each sh In wbDst.Worksheets
        If sh.Name = "월별실적" Then Set wsDst = sh: Exit For
    Next sh
    If wsDst Is Nothing Then Err.Raise vbObjectError + 513, "B2BSkill", "'월별실적' 시트를 찾지 못했습니다."

    ' 3. 매출 시트에서 '건수' 열 찾기 및 합계 계산
    Dim hdrRow As Long: hdrRow = 1 ' 매출 시트 헤더는 1행
    Dim lastCol As Long, lastRow As Long
    Dim colIdx As Long, countCol As Long
    countCol = 0
    
    lastCol = wsSrc.Cells(hdrRow, wsSrc.Columns.Count).End(xlToLeft).Column
    For colIdx = 1 To lastCol
        If Trim(CStr(wsSrc.Cells(hdrRow, colIdx).Value)) = "건수" Then
            countCol = colIdx
            Exit For
        End If
    Next colIdx
    
    If countCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'건수' 열을 찾지 못했습니다."

    lastRow = wsSrc.Cells(wsSrc.Rows.Count, countCol).End(xlUp).Row
    If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."

    Dim dataArr As Variant
    Dim sumCounts As Double
    Dim r As Long
    
    ' 데이터 범위 배열로 읽기 (헤더 제외)
    Dim dataRng As Range
    Set dataRng = wsSrc.Range(wsSrc.Cells(hdrRow + 1, countCol), wsSrc.Cells(lastRow, countCol))
    dataArr = dataRng.Value
    
    sumCounts = 0
    For r = 1 To UBound(dataArr, 1)
        If IsNumeric(dataArr(r, 1)) Then
            sumCounts = sumCounts + CDbl(dataArr(r, 1))
        End If
    Next r

    ' 4. 결과 값 입력 (월별실적 B4)
    wsDst.Cells(4, 2).Value = sumCounts ' B4 셀에 값으로 입력

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## paste_values_only_openpyxl / write_amount_total_value — PASS

Prompt:
```text
매출 금액 합계를 계산해서 그 결과 숫자만 월별실적 C4에 박아줘. 수식 필요 없고 값으로. 빈칸(null)이면 안 돼.
```
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!C4` → 3797128000
- 근거: VBA는 input_매출_2026_4월.xlsx의 매출 시트 D2:D1201(1200행 데이터) 금액 열 합계를 WorksheetFunction.Sum으로 구한 뒤, output_청구서_템플릿.xlsx의 월별실적!C4에 값만 기입한다. 수식을 사용하지 않고 .Value에 직접 숫자를 할당하므로 수식 잔여 없이 값만 남는다. 기대 결과(3797128000)와 일치하며, D열의 수식 셀(D5=C5-C4 등)은 건드리지 않으므로 보존된다. On Error Resume Next 없이 Err.Raise로 오류를 상위에 전달하는 구조도 적절하다.
- 위험: input_매출_2026_4월.xlsx 및 output_청구서_템플릿.xlsx 가 COM 세션에서 열려 있지 않으면 vbObjectError+515 로 실패하지만, 이는 Python COM 호출 측에서 미리 열어 두어야 할 사전 조건 문제이므로 VBA 자체의 결함은 아님
- 위험: 금액 열(D열=4열)에 숫자가 아닌 텍스트형 숫자가 섞여 있을 경우 WorksheetFunction.Sum 이 해당 셀을 무시하여 합계가 실제보다 작아질 수 있음(스키마상 '1435000' 등이 텍스트로 저장될 가능성 존재)
- 위험: lastRow 가 헤더만 있는 1행으로 끝날 경우 Err.Raise 로 정상 보호되지만, 실제 데이터가 1201행이므로 해당 상황은 발생하지 않을 것으로 예상

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 입력 파일 및 시트 참조
    Dim wbSrc As Workbook, wsSrc As Worksheet
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    
    Set wsSrc = wbSrc.Worksheets("매출")

    ' 2. 매출 데이터 범위 확인 및 합계 계산
    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 4).End(xlUp).Row ' 금액 열(4열) 기준 마지막 행
    
    If lastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "매출 데이터가 없습니다."
    
    Dim salesRange As Range
    Set salesRange = wsSrc.Range(wsSrc.Cells(2, 4), wsSrc.Cells(lastRow, 4))
    
    Dim totalSales As Double
    totalSales = Application.WorksheetFunction.Sum(salesRange)

    ' 3. 출력 파일 및 시트 참조
    Dim wbDst As Workbook, wsDst As Worksheet
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    
    Set wsDst = wbDst.Worksheets("월별실적")

    ' 4. 결과 값 입력 (수식 아님, 값만)
    wsDst.Cells(4, 3).Value = totalSales ' C4 셀

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## paste_values_only_openpyxl / values_only_preserve_source_formula — WARN

Prompt:
```text
회사별요약 합계행(24행) 매출 합계를 '값으로' 월별실적 B5에 옮겨 적어줘. 단 회사별요약 24행의 SUM 수식 자체는 그대로 둬야 해. (openpyxl이라 그 SUM의 계산값은 직접 못 읽으니, 매출 시트 금액을 Python으로 합산해서 넣어.)
```
Warnings:
- Sonnet 검수 RISK: Qwen 코드는 매출 합산 로직 자체(input_매출_2026_4월.xlsx 매출 시트 D열 합산)는 올바르지만, 결과를 기입할 대상 파일을 잘못 지정했습니다. 월별실적 시트는 output_청구서_템플릿.xlsx에 있는데 output_v058_regression_target.xlsx를 열어 Worksheets("월별실적")를 찾으므로 런타임 오류 9가 발생합니다. 회사별요약!B24 수식은 코드에서 건드리지 않아 보존 의도는 맞지만, 애초에 값 기입 자체가 실패하므로 expected 상태(월별실적!B5에 숫자 기입)를 달성하지 못합니다.
Passed:
- Sub B2BSkill() found.
- End Sub found.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 아니오 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `월별실적!B5` → input_매출_2026_4월.xlsx 매출 시트의 D열(금액) 합산값(숫자). 스키마상 1200행이므로 실제 합산 결과가 들어감
  - `회사별요약!B24` → (변경 없음) =SUM(B4:B23) 수식 그대로 보존
  - `월별실적!C5` → (변경 없음)
- 근거: Qwen 코드는 매출 합산 로직 자체(input_매출_2026_4월.xlsx 매출 시트 D열 합산)는 올바르지만, 결과를 기입할 대상 파일을 잘못 지정했습니다. 월별실적 시트는 output_청구서_템플릿.xlsx에 있는데 output_v058_regression_target.xlsx를 열어 Worksheets("월별실적")를 찾으므로 런타임 오류 9가 발생합니다. 회사별요약!B24 수식은 코드에서 건드리지 않아 보존 의도는 맞지만, 애초에 값 기입 자체가 실패하므로 expected 상태(월별실적!B5에 숫자 기입)를 달성하지 못합니다.
- 위험: output_v058_regression_target.xlsx에는 '월별실적' 시트가 존재하지 않으므로, wbDst.Worksheets("월별실적") 에서 런타임 오류 9(subscript out of range) 발생 — 값이 기입되지 않음
- 위험: 올바른 대상 파일은 output_청구서_템플릿.xlsx 임에도 불구하고 Qwen이 output_v058_regression_target.xlsx를 대상으로 설정하여 엉뚱한 파일에 쓰려고 시도함
- 위험: totalAmount가 0일 경우 조용히 0을 기입하는데, 실제로는 1200행 데이터가 있어 합산 결과는 0이 아닐 것이므로 이 분기는 실질적 문제 없음
- 수정 필요: 대상 워크북을 output_v058_regression_target.xlsx → output_청구서_템플릿.xlsx 로 수정
- 수정 필요: wbDst.Worksheets("월별실적") 접근 전 시트 존재 여부 확인 추가 또는 올바른 파일명으로 수정만으로 해결 가능

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_Qwen 코드의 핵심 오류는 결과를 output_v058_regression_target.xlsx의 월별실적 시트에 쓰는 것인데, 스키마상 월별실적 시트는 output_청구서_템플릿.xlsx에 존재합니다. output_v058_regression_target.xlsx에는 월별실적 시트가 없으므로 Worksheets("월별실적") 호출 시 런타임 오류 9(subscript out of range)가 발생합니다. 개선안은 올바른 대상 파일(output_청구서_템플릿.xlsx)을 명시하고, 회사별요약!B24 수식을 건드리지 않음을 코드 주석으로 명확히 합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation
    prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 1. 소스: 매출 시트 금액 합산
    Dim wbSrc As Workbook
    Dim wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then
        Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    End If

    Dim wsSrc As Worksheet
    Set wsSrc = wbSrc.Worksheets("매출")

    Dim lastRow As Long
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 4).End(xlUp).Row
    If lastRow < 2 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "매출 시트에 데이터가 없습니다."
    End If

    Dim dataArr As Variant
    dataArr = wsSrc.Range(wsSrc.Cells(2, 4), wsSrc.Cells(lastRow, 4)).Value

    Dim totalAmount As Double
    totalAmount = 0
    Dim r As Long
    For r = 1 To UBound(dataArr, 1)
        If IsNumeric(dataArr(r, 1)) And Not IsEmpty(dataArr(r, 1)) Then
            totalAmount = totalAmount + CDbl(dataArr(r, 1))
        End If
    Next r

    ' 2. 대상: output_청구서_템플릿.xlsx 의 월별실적!B5 에 값만 입력
    Dim wbDst As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then
        Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
    End If

    Dim wsDst As Worksheet
    Set wsDst = wbDst.Worksheets("월별실적")

    ' 회사별요약 B24 수식 보존 여부 사전 확인
    Dim wsSum As Worksheet
    Set wsSum = wbDst.Worksheets("회사별요약")
    If wsSum.Cells(24, 2).HasFormula Then
        ' 수식 그대로 두고 건드리지 않음 — 아래에서 wsDst 만 수정
    End If

    ' B5(5행, 2열) 에 값만 기입 (C5 수식 등 인접 셀 건드리지 않음)
    wsDst.Cells(5, 2).Value = totalAmount

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wbDst As Workbook
    Dim wsSrc As Worksheet, wsDst As Worksheet
    Dim wb As Workbook
    
    ' 1. 소스 워크북 및 시트 찾기 (매출 데이터)
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    
    Set wsSrc = wbSrc.Worksheets("매출")
    
    ' 2. 대상 워크북 및 시트 찾기 (결과 입력)
    For Each wb In Application.Workbooks
        If wb.Name = "output_v058_regression_target.xlsx" Then Set wbDst = wb: Exit For
    Next wb
    If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_v058_regression_target.xlsx' 가 열려 있지 않습니다."
    
    Set wsDst = wbDst.Worksheets("월별실적")
    
    ' 3. 매출 데이터 합산 (VBA에서 직접 계산)
    Dim lastRow As Long
    Dim dataArr As Variant
    Dim totalAmount As Double
    Dim r As Long
    
    ' 매출 시트에서 금액 열(4열)의 마지막 행 찾기
    lastRow = wsSrc.Cells(wsSrc.Rows.Count, 4).End(xlUp).Row
    If lastRow < 2 Then Err.Raise vbObjectError + 513, "B2BSkill", "매출 데이터가 없습니다."
    
    ' 데이터 배열 읽기 (2행부터 마지막 행까지, 4열만)
    ' 범위가 크면 전체를 읽지 않고 금액 열만 읽는 것이 효율적이지만, 
    ' 여기서는 간단하게 금액 열 범위를 배열로 읽습니다.
    Dim amountRange As Range
    Set amountRange = wsSrc.Range(wsSrc.Cells(2, 4), wsSrc.Cells(lastRow, 4))
    dataArr = amountRange.Value
    
    ' 합산
    totalAmount = 0
    For r = 1 To UBound(dataArr, 1)
        If IsNumeric(dataArr(r, 1)) Then
            totalAmount = totalAmount + CDbl(dataArr(r, 1))
        End If
    Next r
    
    ' 4. 결과 입력 (월별실적 시트 B5)
    ' B5는 5행 2열
    wsDst.Cells(5, 2).Value = totalAmount
    
    If totalAmount = 0 Then
        ' 매출이 0인 경우에도 작업은 수행된 것으로 보지만, 
        ' 데이터가 비어있다면 오류로 처리할 수도 있습니다. 
        ' 여기서는 0도 유효한 값으로 간주합니다.
    End If

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: PASS

## raise_when_not_applied / sort_must_raise_if_no_column — NEEDS_WINDOWS

Prompt:
```text
회사별요약에서 '존재하지않는열' 헤더 기준으로 정렬해줘. 그 헤더가 없으면 조용히 끝내지 말고 오류를 내서 실패를 알려줘.
```
Needs Windows:
- 대상이 없거나 변경 0건일 때 조용히 끝내지 않고 Err.Raise 로 실패가 드러나는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 변경 0건/미존재 시 Err.Raise.
- Forbidden pattern absent: \bMsgBox\b
- Forbidden pattern absent: GoTo\s+Cleanup\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Raises an error when target/condition not met (no false 'applied').
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A3:E24(정렬 범위)` → (변경 없음) — keyCol=0 이므로 Err.Raise 가 먼저 실행되어 정렬 코드에 도달하지 않음
  - `(전체 시트)` → Err.Raise vbObjectError+513 이 발생하여 Python COM 측에서 예외가 전파됨. 워크북 내 어떤 셀도 변경되지 않음.
- 근거: 헤더 '존재하지않는열'이 회사별요약 시트에 없으므로 keyCol=0 이 되어 Err.Raise vbObjectError+513 이 실행된다. MsgBox·조용한 종료 없이 오류가 COM 호출자에게 전파되므로 사용자 의도와 정확히 부합한다. 정렬 코드 및 수식 변경 경로에는 도달하지 않으므로 워크북 데이터는 온전히 보존된다. 다만 Err.Raise 직전에 설정한 ScreenUpdating=False 와 Calculation=Manual 이 복원되지 않는 소규모 부작용이 존재한다.
- 위험: Application.Calculation = xlCalculationManual 로 설정한 뒤 Err.Raise 로 빠져나가면 xlCalculationAutomatic 복원 코드가 실행되지 않아 Excel Application 이 수동 계산 상태로 남을 수 있음. 단, Python COM 세션은 이후 워크북을 닫으므로 실질 영향은 제한적이지만 주의 필요.
- 위험: Application.ScreenUpdating = False 도 마찬가지로 Err.Raise 후 복원되지 않음. COM 세션 종료 전까지 화면 갱신이 멈춰 있을 수 있음.

Generated VBA:
```vba
Sub B2BSkill()
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("output_청구서_템플릿.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")
    
    Dim targetHeader As String: targetHeader = "존재하지않는열"
    Dim hdrRow As Long: hdrRow = 3 ' 스키마에 따르면 헤더는 3행
    
    Dim lastCol As Long
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    
    Dim keyCol As Long: keyCol = 0
    Dim c As Long
    For c = 1 To lastCol
        If Trim(CStr(ws.Cells(hdrRow, c).Value)) = targetHeader Then
            keyCol = c
            Exit For
        End If
    Next c
    
    If keyCol = 0 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "헤더 '" & targetHeader & "'를 찾지 못했습니다."
    End If

    ' 헤더가 존재할 경우에만 정렬 수행 (요청에 따라 헤더가 없으면 오류 발생하므로 여기는 도달하지 않음)
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, keyCol).End(xlUp).Row
    
    ' 합계/요약행 제외 확인 (마지막 행이 합계 수식이나 라벨이면 제외)
    If lastRow > hdrRow Then
        Dim checkVal As String
        checkVal = Trim(CStr(ws.Cells(lastRow, keyCol).Value))
        If InStr(checkVal, "합계") > 0 Or InStr(checkVal, "평균") > 0 Or InStr(checkVal, "총계") > 0 Then
            lastRow = lastRow - 1
        End If
    End If
    
    If lastRow > hdrRow Then
        ws.Range(ws.Cells(hdrRow, 1), ws.Cells(lastRow, lastCol)).Sort _
            Key1:=ws.Cells(hdrRow, keyCol), Order1:=xlAscending, Header:=xlYes
    End If

    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
End Sub
```

Attempts:
- 0: FAIL
- 1: NEEDS_WINDOWS

## raise_when_not_applied / delete_sheet_raise_if_missing — NEEDS_WINDOWS

Prompt:
```text
'당월매출(통합)' 시트를 삭제해줘. 그런 시트가 없으면 아무 일도 안 한 채 '완료'라고 하지 말고 오류로 알려줘.
```
Warnings:
- Sonnet 검수 RISK: 기존 VBA는 시트가 존재하지 않을 때 Worksheets("당월매출(통합)") 접근에서 런타임 오류(subscript out of range)가 발생하여 ErrHandler로 분기하고 Err.Raise로 오류를 전파하므로 사용자 의도(오류로 알려줘)에는 부합한다. 시트가 존재하면 삭제 후 ErrHandler로 낙하하지만 Err.Number=0이므로 Err.Raise 없이 정상 종료된다. 의도 자체는 달성되나, Exit Sub 누락으로 인한 ErrHandler fall-through 구조와 DisplayAlerts 미복원 가능성이 잠재적 위험으로 남아 RISK로 판정한다.
Needs Windows:
- 대상이 없거나 변경 0건일 때 조용히 끝내지 않고 Err.Raise 로 실패가 드러나는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 변경 0건/미존재 시 Err.Raise.
- Forbidden pattern absent: \bMsgBox\b
- Forbidden pattern absent: GoTo\s+Cleanup\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Raises an error when target/condition not met (no false 'applied').
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `(시트 존재 시) 당월매출(통합) 시트` → 삭제됨
  - `(시트 부재 시) 오류 발생` → Err.Raise로 오류 전파
- 근거: 기존 VBA는 시트가 존재하지 않을 때 Worksheets("당월매출(통합)") 접근에서 런타임 오류(subscript out of range)가 발생하여 ErrHandler로 분기하고 Err.Raise로 오류를 전파하므로 사용자 의도(오류로 알려줘)에는 부합한다. 시트가 존재하면 삭제 후 ErrHandler로 낙하하지만 Err.Number=0이므로 Err.Raise 없이 정상 종료된다. 의도 자체는 달성되나, Exit Sub 누락으로 인한 ErrHandler fall-through 구조와 DisplayAlerts 미복원 가능성이 잠재적 위험으로 남아 RISK로 판정한다.
- 위험: 정상 실행 후에도 ErrHandler 레이블 이하 코드가 실행된다(fall-through). Err.Number=0이므로 Err.Raise는 호출되지 않아 실제 결과는 올바르지만, 구조적으로 불안정하다.
- 위험: On Error GoTo ErrHandler 설정 후 ws.Delete 중 DisplayAlerts=True 복원 전에 오류가 발생하면 Application.DisplayAlerts가 False로 남을 수 있다.
- 위험: ErrHandler 블록에서 Application.ScreenUpdating=True 복원 후 Err.Raise를 호출하는데, 만약 중간에 다른 오류가 중첩되면 원래 오류 정보(Number/Description)가 덮일 수 있다.
- 위험: 워크북에 시트가 1개뿐일 때 ws.Delete 시도 시 Excel이 1004 오류를 발생시킬 수 있다(최소 1개 시트 보존 규칙).
- 수정 필요: 정상 실행 경로가 ErrHandler 블록으로 낙하(fall-through)하지 않도록 ErrHandler 앞에 Exit Sub를 추가하거나, 구조를 명시적 존재 확인 방식으로 변경할 것.
- 수정 필요: Application.DisplayAlerts = False 상태에서 오류 발생 시 True로 복원되도록 ErrHandler 내에 Application.DisplayAlerts = True 복원 코드를 추가할 것.

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_기존 코드는 ErrHandler 레이블 구조 때문에 정상 실행 경로에서도 ErrHandler 블록이 낙하(fall-through)되어 Err.Number가 0인 채로 Err.Raise 분기에는 진입하지 않지만, On Error GoTo ErrHandler가 설정된 상태에서 오류 없이 ws.Delete까지 완료되면 ErrHandler: 이하 코드가 실행되고 Err.Number=0 이므로 Err.Raise는 건너뛰며 정상 종료된다. 그러나 이 패턴은 정상 경로와 오류 경로를 혼용하여 코드 가독성이 낮고, 향후 확장 시 실수 위험이 있다. 개선안은 On Error 없이 명시적 루프로 시트 존재 여부를 먼저 확인하고, 없으면 즉시 Err.Raise로 실패를 드러내며, 있으면 안전하게 삭제하는 구조로 의도를 더 명확히 표현한다._

```vba
Sub B2BSkill()
    Dim ws As Worksheet
    Dim bFound As Boolean
    bFound = False

    Application.ScreenUpdating = False

    Dim w As Worksheet
    For Each w In ActiveWorkbook.Worksheets
        If w.Name = "당월매출(통합)" Then
            bFound = True
            Exit For
        End If
    Next w

    If Not bFound Then
        Application.ScreenUpdating = True
        Err.Raise 9, "B2BSkill", "시트 '당월매출(통합)'을 찾을 수 없습니다. 삭제 대상이 존재하지 않아 작업을 중단합니다."
    End If

    Application.DisplayAlerts = False
    ActiveWorkbook.Worksheets("당월매출(통합)").Delete
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Application.ScreenUpdating = False
    On Error GoTo ErrHandler
    
    Dim ws As Worksheet
    ' 직접 시트 참조: 존재하지 않으면 즉시 오류 발생
    Set ws = ActiveWorkbook.Worksheets("당월매출(통합)")
    
    Application.DisplayAlerts = False
    ws.Delete
    Application.DisplayAlerts = True
    
ErrHandler:
    Application.ScreenUpdating = True
    If Err.Number <> 0 Then
        Err.Raise Err.Number, Err.Source, Err.Description
    End If
End Sub
```

Attempts:
- 0: FAIL
- 1: NEEDS_WINDOWS

## raise_when_not_applied / replace_raise_if_zero_match — NEEDS_WINDOWS

Prompt:
```text
회사별요약 회사명에서 '없는회사'를 '대체'로 바꿔줘. 치환이 0건이면 변경 없음을 오류로 드러내줘.
```
Warnings:
- Sonnet 검수 RISK: 코드의 핵심 로직(워크북/시트 탐색, 회사명 열 순회, changed=0이면 Err.Raise)은 사용자 의도와 일치하며 COM 런타임에서 대체로 실행됩니다. 그러나 A열 전체를 2차원 배열로 읽어 Range.Value = arr 로 재기록하는 방식은 시트에 병합셀(A1:E1)이 있는 환경에서 범위 경계가 어긋날 경우 1004 오류를 유발할 수 있습니다. 또한 실제 데이터에 '없는회사'가 없으므로 changed=0 → Err.Raise 경로가 항상 실행되는데, 이는 기대 결과(치환 0건이면 Err.Raise)와 일치하므로 의도 부합 판정입니다. 병합셀 재쓰기 위험 때문에 RISK로 판정합니다.
Needs Windows:
- 대상이 없거나 변경 0건일 때 조용히 끝내지 않고 Err.Raise 로 실패가 드러나는지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 변경 0건/미존재 시 Err.Raise.
- Forbidden pattern absent: \bMsgBox\b
- Forbidden pattern absent: GoTo\s+Cleanup\b
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Raises an error when target/condition not met (no false 'applied').
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 아니오
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `회사별요약!A4` → ABC통신 (변경 없음, '없는회사' 없으므로 changed=0 → Err.Raise 발생)
  - `회사별요약!A5` → 글로벌네트워크 (변경 없음)
  - `회사별요약!D4` → =B4-C4 (수식 보존 — A열만 .Value= 배열 쓰기이므로 D/E열은 영향 없음)
  - `회사별요약!E4` → =IFERROR(D4/B4,0) (수식 보존)
- 근거: 코드의 핵심 로직(워크북/시트 탐색, 회사명 열 순회, changed=0이면 Err.Raise)은 사용자 의도와 일치하며 COM 런타임에서 대체로 실행됩니다. 그러나 A열 전체를 2차원 배열로 읽어 Range.Value = arr 로 재기록하는 방식은 시트에 병합셀(A1:E1)이 있는 환경에서 범위 경계가 어긋날 경우 1004 오류를 유발할 수 있습니다. 또한 실제 데이터에 '없는회사'가 없으므로 changed=0 → Err.Raise 경로가 항상 실행되는데, 이는 기대 결과(치환 0건이면 Err.Raise)와 일치하므로 의도 부합 판정입니다. 병합셀 재쓰기 위험 때문에 RISK로 판정합니다.
- 위험: A열 전체 범위를 배열로 읽어 dataRng.Value = arr 로 재기록 시, A열에 병합셀이 존재하면 1004 오류 발생 가능
- 위험: '없는회사' 데이터가 실제로 존재하지 않으므로 changed=0 → Err.Raise 경로로 빠짐 (이는 의도된 동작이지만, 실제 파일에 해당 값이 없을 때 항상 오류로 끝남을 인지해야 함)
- 위험: 합계 행 제외 로직이 마지막 행 1개만 체크하므로, 합계 행이 여러 개이거나 위치가 다르면 합계 행 셀에도 쓰기 시도 가능
- 수정 필요: 배열 전체 재쓰기(dataRng.Value = arr) 대신 매칭 셀만 cell.Value = "대체" 로 직접 수정하여 병합셀 1004 오류 방지

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 A열 전체를 2차원 배열로 읽어 dataRng.Value = arr 로 한꺼번에 재기록합니다. A열만 대상이고 D/E열 수식은 건드리지 않으므로 이번 요청에서 수식 파괴 위험은 낮지만, 병합셀(A1:E1)이 있는 시트에서 범위를 잘못 잡거나 A열에 병합된 셀이 있을 경우 1004 오류 가능성이 있습니다. 개선안은 배열 전체 재쓰기 대신 셀 단위로 순회하여 매칭된 셀만 직접 .Value를 수정하므로 병합셀 충돌 위험이 없고, 합계/요약 행 판별 로직도 D/E열 수식을 기준으로 명확히 처리합니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation
    prevCalc = Application.Calculation
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    On Error GoTo ErrHandler

    ' 워크북 탐색
    Dim wb As Workbook
    Dim foundWb As Boolean
    foundWb = False
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            foundWb = True
            Exit For
        End If
    Next wb
    If Not foundWb Then
        Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx'가 열려 있지 않습니다."
    End If

    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")

    Const HDR_ROW As Long = 3
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

    If lastRow <= HDR_ROW Then
        Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."
    End If

    ' 셀 단위 순회: 배열 전체 재쓰기 대신 매칭 셀만 직접 수정 → 병합/수식 안전
    Dim changed As Long
    changed = 0
    Dim r As Long
    For r = HDR_ROW + 1 To lastRow
        Dim cell As Range
        Set cell = ws.Cells(r, 1)
        ' 합계/요약 행 건너뜀 (D열 SUM, E열 AVERAGE)
        If InStr(1, CStr(cell.Offset(0, 3).Formula), "SUM") > 0 Or _
           InStr(1, CStr(cell.Offset(0, 4).Formula), "AVERAGE") > 0 Then
            ' skip
        ElseIf CStr(cell.Value) = "없는회사" Then
            cell.Value = "대체"
            changed = changed + 1
        End If
    Next r

    If changed = 0 Then
        Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다(대상/조건 확인)."
    End If

    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    Exit Sub

ErrHandler:
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    Err.Raise Err.Number, Err.Source, Err.Description
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation
    prevCalc = Application.Calculation
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    On Error GoTo ErrHandler

    Dim wb As Workbook
    Dim foundWb As Boolean
    foundWb = False
    For Each wb In Application.Workbooks
        If wb.Name = "output_청구서_템플릿.xlsx" Then
            foundWb = True
            Exit For
        End If
    Next wb
    If Not foundWb Then
        Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx'가 열려 있지 않습니다."
    End If

    Dim ws As Worksheet
    Set ws = wb.Worksheets("회사별요약")

    Dim hdrRow As Long
    hdrRow = 3
    
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    
    ' 합계/요약 행 제외 (마지막 행이 수식 행일 경우)
    If lastRow > hdrRow Then
        If InStr(1, CStr(ws.Cells(lastRow, 4).Formula), "SUM") > 0 Or InStr(1, CStr(ws.Cells(lastRow, 5).Formula), "AVERAGE") > 0 Then
            lastRow = lastRow - 1
        End If
    End If

    If lastRow <= hdrRow Then
        Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."
    End If

    ' 회사명 열(A열) 데이터 읽기
    Dim dataRng As Range
    Set dataRng = ws.Range(ws.Cells(hdrRow + 1, 1), ws.Cells(lastRow, 1))
    Dim arr As Variant
    arr = dataRng.Value

    Dim changed As Long
    changed = 0
    Dim r As Long
    For r = 1 To UBound(arr, 1)
        If arr(r, 1) = "없는회사" Then
            arr(r, 1) = "대체"
            changed = changed + 1
        End If
    Next r

    If changed = 0 Then
        Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다(대상/조건 확인)."
    End If

    ' 변경된 배열 다시 쓰기
    dataRng.Value = arr

    ' 성공 시 정리
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    Exit Sub

ErrHandler:
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    Err.Raise Err.Number, Err.Source, Err.Description
End Sub
```

Attempts:
- 0: FAIL
- 1: NEEDS_WINDOWS

## single_sheet_scope / clear_sales_d_column_only — NEEDS_WINDOWS

Prompt:
```text
input_매출_2026_4월.xlsx 에 매출·고객정보·월별집계 시트가 있어. 매출 시트의 금액(D열) 값만 지워줘. 고객정보와 월별집계 시트는 절대 건드리지 마.
```
Needs Windows:
- 매출 시트만 바뀌고 고객정보/월별집계 시트는 불변인지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Forbidden pattern absent: Worksheets\.Count
- Forbidden pattern absent: \.Cells\s*\.\s*Clear
- Forbidden pattern absent: \.UsedRange\s*\.\s*Clear
- No all-worksheet loop for single-sheet request.
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!D1` → '금액' (헤더, 변경 없음)
  - `매출!D2` → '' (빈 값 — ClearContents)
  - `매출!D3` → '' (빈 값 — ClearContents)
  - `매출!D1201` → '' (빈 값 — ClearContents, 마지막 데이터 행)
  - `고객정보!A1` → (변경 없음)
  - `월별집계!A1` → (변경 없음)
- 근거: 코드는 사용자 요청 그대로 input_매출_2026_4월.xlsx 의 매출 시트 D2:D1201 범위만 ClearContents 로 지우며, 고객정보·월별집계 시트에 대한 접근이 전혀 없습니다. For Each Worksheets 순회도 없고, 헤더 행(D1)도 보호됩니다. 오류는 Cleanup 에서 Err.Raise 로 재발생되어 조용한 무시가 없습니다. On Error Resume Next 미사용, 금지 패턴 없음으로 PASS 판정합니다.
- 위험: wbSrc.Worksheets("매출") 호출 시 시트명이 다르거나 없으면 Subscript out of range(9) 런타임 오류가 발생할 수 있으나, Cleanup 에서 Err.Raise 로 재발생되므로 조용히 묻히지는 않음
- 위험: 시트가 보호(Protected)된 경우 ClearContents 실행 시 1004 오류 가능 — 현재 코드에는 Unprotect 처리 없음
- 위험: D열 마지막 행 탐색을 D열 기준으로만 하므로, D열 일부 셀이 비어 있으면 실제 데이터 하단 일부가 누락될 수 있음(스키마상 1201행이므로 현실적 위험은 낮음)

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 기능적으로 충분하지만, Worksheets("매출") 접근 실패 시 오류가 모호하게 처리될 수 있으므로 시트 존재 여부를 명시적으로 검증하는 블록을 추가했습니다. 나머지 로직(워크북 탐색, 헤더 제외 ClearContents, 에러 재발생)은 동일하게 유지했습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation
    prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then
        Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."
    End If

    ' 오직 매출 시트만 접근 — 고객정보/월별집계 시트는 일절 건드리지 않음
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = wbSrc.Worksheets("매출")
    On Error GoTo Cleanup
    If ws Is Nothing Then
        Err.Raise vbObjectError + 514, "B2BSkill", "'매출' 시트를 찾을 수 없습니다."
    End If

    Const HDR_ROW As Long = 1
    Const DATA_COL As Long = 4  ' D열(금액)

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, DATA_COL).End(xlUp).Row

    If lastRow <= HDR_ROW Then
        Err.Raise vbObjectError + 513, "B2BSkill", "매출 시트 D열에 지울 데이터가 없습니다."
    End If

    ' 헤더(D1) 제외, D2:D{lastRow} 만 지움
    ws.Range(ws.Cells(HDR_ROW + 1, DATA_COL), ws.Cells(lastRow, DATA_COL)).ClearContents

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number
        raisedSrc = Err.Source
        raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, wb As Workbook
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    Dim ws As Worksheet
    Set ws = wbSrc.Worksheets("매출")

    Dim hdrRow As Long: hdrRow = 1
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 4).End(xlUp).Row
    
    If lastRow <= hdrRow Then
        Err.Raise vbObjectError + 513, "B2BSkill", "매출 시트 D열에 데이터가 없습니다."
    End If

    Dim targetRng As Range
    Set targetRng = ws.Range(ws.Cells(hdrRow + 1, 4), ws.Cells(lastRow, 4))
    
    targetRng.ClearContents

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## single_sheet_scope / clear_specific_sheet_column — NEEDS_WINDOWS

Prompt:
```text
@시트[input_매출_2026_4월.xlsx/매출] 여기에서 금액(D) 컬럼 내용만 비워줘. 다른 시트의 같은 열은 유지해야 해.

[정확 참조]
- 대상: 파일 "input_매출_2026_4월.xlsx", 시트 "매출", 열 "D"
```
Needs Windows:
- 매출 시트만 바뀌고 고객정보/월별집계 시트는 불변인지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Forbidden pattern absent: Worksheets\.Count
- Forbidden pattern absent: \.Cells\s*\.\s*Clear
- Forbidden pattern absent: \.UsedRange\s*\.\s*Clear
- No all-worksheet loop for single-sheet request.
- No ActiveCell.Offset detected.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `input_매출_2026_4월.xlsx/매출!D2` → (빈 값 — ClearContents 후)
  - `input_매출_2026_4월.xlsx/매출!D3` → (빈 값 — ClearContents 후)
  - `input_매출_2026_4월.xlsx/매출!D1201` → (빈 값 — ClearContents 후, lastRow=1201 기준 마지막 행까지)
  - `input_매출_2026_4월.xlsx/고객정보!D열` → (변경 없음 — 해당 시트 미접근)
  - `input_매출_2026_4월.xlsx/월별집계!D열` → (변경 없음 — 해당 시트 미접근)
- 근거: 코드는 wb=Workbooks("input_매출_2026_4월.xlsx")로 대상 워크북을, ws=wb.Worksheets("매출")로 대상 시트를 정확히 한정하고, D열(4열) 데이터 행(2행~lastRow)에만 ClearContents를 수행한다. 다른 시트나 다른 열에는 전혀 접근하지 않으며, 헤더(D1)도 보존된다. On Error GoTo Cleanup 후 raisedNum 재발생 패턴으로 오류를 숨기지 않아 COM 런타임 오류도 드러난다. 전체적으로 사용자 의도(매출 시트 D열만 비우기, 타 시트 유지)와 정확히 일치하며 런타임 실패 가능성도 낮아 PASS로 판정한다.
- 위험: D열 헤더(D1)는 ClearContents 대상에 포함되지 않아 안전하나, lastRow 산출 기준이 D열(4열)의 마지막 비어있지 않은 행이므로, 만약 D열 중간에 빈 셀이 있으면 실제 데이터 마지막 행이 과소 추정될 수 있음. 그러나 헤더가 있는 일반 데이터 구조에서는 큰 문제 없음.
- 위험: lastRow가 2 미만인 경우(헤더만 있을 때) Err.Raise로 명시적 중단하므로 no-op 위험은 낮음

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")
    
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 4).End(xlUp).Row
    
    If lastRow < 2 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "지울 데이터가 없습니다."
    End If
    
    Dim targetRng As Range
    Set targetRng = ws.Range(ws.Cells(2, 4), ws.Cells(lastRow, 4))
    
    targetRng.ClearContents

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## single_sheet_scope / current_sheet_only — NEEDS_WINDOWS

Prompt:
```text
현재 활성 시트(매출)에서만 금액(D열) 데이터를 삭제해줘. 전체 시트 반복은 하지 마.
```
Warnings:
- Sonnet 검수 RISK: 코드 자체는 For Each 전체 순회 없이 ActiveSheet만 참조하므로 전체 시트 확장 문제는 없습니다. 그러나 현재 컨텍스트상 활성 시트가 '값복사_대상'으로 설정되어 있어 사용자가 의도한 '매출' 시트의 D열이 아닌 엉뚱한 시트의 D열이 삭제될 수 있습니다. 시트 이름에 대한 검증이 없으므로 의도 부합 면에서 RISK 판정이 적합합니다.
Needs Windows:
- 매출 시트만 바뀌고 고객정보/월별집계 시트는 불변인지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Forbidden pattern absent: Worksheets\.Count
- Forbidden pattern absent: \.Cells\s*\.\s*Clear
- Forbidden pattern absent: \.UsedRange\s*\.\s*Clear
- No all-worksheet loop for single-sheet request.
- No ActiveCell.Offset detected.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 아니오 · 범위 한정: 아니오 · 수식 보존: 예
- 기대결과 일치(expected): 아니오
- COM 실행 시뮬레이션(셀→결과):
  - `값복사_대상!D2` → (변경 없음)
  - `값복사_대상!G2` → =ROW()*100 (변경 없음)
  - `값복사_대상!H2` → =ROW()*999 (변경 없음)
  - `매출!D2` → (변경 없음 — 이 VBA는 실행되지 않음)
- 근거: 코드 자체는 For Each 전체 순회 없이 ActiveSheet만 참조하므로 전체 시트 확장 문제는 없습니다. 그러나 현재 컨텍스트상 활성 시트가 '값복사_대상'으로 설정되어 있어 사용자가 의도한 '매출' 시트의 D열이 아닌 엉뚱한 시트의 D열이 삭제될 수 있습니다. 시트 이름에 대한 검증이 없으므로 의도 부합 면에서 RISK 판정이 적합합니다.
- 위험: 현재 활성 시트가 스키마상 '값복사_대상'(output_v058_regression_target.xlsx)인데, 코드는 ActiveSheet를 그대로 사용하므로 '매출' 시트가 아닌 '값복사_대상' 시트의 D열이 삭제될 수 있음
- 위험: 사용자가 요청한 대상 파일(input_매출_2026_4월.xlsx)의 '매출' 시트가 현재 활성 워크북/시트가 아닌 경우, 전혀 다른 파일·시트에서 D열 삭제가 실행됨
- 위험: 시트 이름 검증이 없어 어느 시트가 활성화되어 있어도 조용히 D열을 삭제하므로 실수로 다른 시트 데이터를 날릴 가능성 있음
- 수정 필요: ActiveSheet 사용 전에 ws.Name = '매출' 인지 확인하고 불일치 시 Err.Raise로 명시적 오류 발생 처리 추가
- 수정 필요: 대상 파일이 input_매출_2026_4월.xlsx임을 감안하여, 가능하면 해당 파일의 '매출' 시트를 명시적으로 참조하거나 최소한 시트명 Guard를 추가할 것

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_사용자가 '매출' 시트의 D열을 삭제하도록 요청했으나, 현재 활성 시트가 스키마상 '값복사_대상'(output_v058_regression_target.xlsx)이므로 엉뚱한 시트에 작동할 위험이 있습니다. 시트 이름을 명시적으로 검증하는 Guard 조건(ws.Name <> '매출')을 추가하면 잘못된 시트에서 실행 시 즉시 오류를 발생시켜 의도치 않은 데이터 삭제를 방지할 수 있습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    ' 활성 워크북의 활성 시트 참조 (For Each 전체 순회 없음)
    Dim ws As Worksheet
    Set ws = ActiveWorkbook.ActiveSheet

    ' 대상 시트가 "매출"인지 확인
    If ws.Name <> "매출" Then
        Err.Raise vbObjectError + 514, "B2BSkill", _
            "현재 활성 시트가 '매출'이 아닙니다. 현재 시트: " & ws.Name
    End If

    ' D열 기준 마지막 데이터 행 찾기
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 4).End(xlUp).Row

    If lastRow < 2 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "D열에 삭제할 데이터가 없습니다."
    End If

    ' D열 데이터(2행~마지막 행) 내용 삭제
    ws.Range(ws.Cells(2, 4), ws.Cells(lastRow, 4)).ClearContents

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim ws As Worksheet
    Set ws = ActiveWorkbook.ActiveSheet

    Dim lastRow As Long
    ' D열(4열) 기준 마지막 데이터 행 찾기
    lastRow = ws.Cells(ws.Rows.Count, 4).End(xlUp).Row
    
    ' 헤더(1행)가 있고 데이터가 존재하는지 확인
    If lastRow < 2 Then
        Err.Raise vbObjectError + 513, "B2BSkill", "D열에 삭제할 데이터가 없습니다."
    End If

    ' D열 데이터 범위(2행부터 마지막 행까지)의 내용만 삭제
    ws.Range(ws.Cells(2, 4), ws.Cells(lastRow, 4)).ClearContents

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## sort_target_column / sort_amount_ascending — NEEDS_WINDOWS

Prompt:
```text
매출 시트를 금액(D)열 기준 오름차순으로 정렬해줘. 건수(C)나 다른 열이 아니라 반드시 금액 열이 정렬 키여야 해.
```
Warnings:
- Sonnet 검수 RISK: 코드는 D열(keyCol=4)을 Key1으로 xlAscending 정렬하므로 사용자 요청(금액 D열 오름차순)과 의도가 일치하고, 헤더 행 처리와 범위도 올바릅니다. COM 런타임에서도 큰 문제 없이 실행될 것으로 보입니다. 다만 lastRow를 D열 End(xlUp)으로 구하는 방식은 D열 중간 빈 셀 존재 시 범위가 잘릴 수 있어 RISK로 판정합니다.
Needs Windows:
- Verify the sort key column matches the requested column header.
- 정렬 키가 요청한 헤더 열과 일치하고 인접 열이 아닌지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 키가 있는 명시적 Sort.
- Forbidden pattern absent: Key1\s*:=\s*(?:ActiveCell|Selection)
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Performs an explicit Sort.
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **RISK**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!A1` → 회사명 (헤더, 변경 없음)
  - `매출!D1` → 금액 (헤더, 변경 없음)
  - `매출!A2` → 정렬 후 D열 금액 최솟값에 해당하는 행의 회사명
  - `매출!D2` → 정렬 후 가장 작은 금액 값 (오름차순 1위)
  - `매출!A1201` → 정렬 후 D열 금액 최댓값에 해당하는 행의 회사명
  - `매출!D1201` → 정렬 후 가장 큰 금액 값 (오름차순 마지막)
- 근거: 코드는 D열(keyCol=4)을 Key1으로 xlAscending 정렬하므로 사용자 요청(금액 D열 오름차순)과 의도가 일치하고, 헤더 행 처리와 범위도 올바릅니다. COM 런타임에서도 큰 문제 없이 실행될 것으로 보입니다. 다만 lastRow를 D열 End(xlUp)으로 구하는 방식은 D열 중간 빈 셀 존재 시 범위가 잘릴 수 있어 RISK로 판정합니다.
- 위험: D열(금액)에 빈 셀이 있으면 lastRow가 실제 데이터 마지막 행보다 짧게 잡혀 일부 행이 정렬 범위에서 누락될 수 있음
- 위험: 금액 열 값이 문자열로 저장된 경우 DataOption1:=xlSortTextAsNumbers로 숫자 정렬은 되나, 원본 데이터가 텍스트 숫자이면 정렬 결과가 예상과 다를 수 있음
- 위험: 합계행 판정을 D열 마지막 행의 수식 여부 1개만 체크하므로 여러 합계행이 있거나 수식 없는 합계행은 걸러지지 않음
- 수정 필요: lastRow 산출 기준을 D열 대신 A열 등 빈 셀이 없는 기준 열로 변경하면 더 안전함

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드에서 lastRow를 keyCol(D열) 기준으로 End(xlUp)로 구하는데, D열에 빈 셀이 중간에 있으면 실제 데이터 행 수보다 적게 잡힐 수 있습니다. 개선안은 상대적으로 빈 값이 없을 가능성이 높은 A열(회사명)을 기준으로 lastRow를 구하고, Key1을 범위 내 상대 셀이 아닌 ws.Columns(KEY_COL) 전체 열로 지정해 정렬 키 오인식 가능성을 명시적으로 제거했습니다. 나머지 로직과 에러 처리는 원본과 동일하게 유지했습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation
    prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")
    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")

    Const HDR_ROW As Long = 1
    Const KEY_COL As Long = 4 ' D열 (금액)

    ' 마지막 행: A열 기준으로 확인 (헤더 포함 1201행)
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    Dim lastCol As Long
    lastCol = ws.Cells(HDR_ROW, ws.Columns.Count).End(xlToLeft).Column

    If lastRow <= HDR_ROW Then
        Err.Raise vbObjectError + 513, "B2BSkill", "정렬할 데이터가 없습니다."
    End If

    ' 합계행 제외: D열 마지막 셀이 수식이면 제외
    Dim checkRow As Long: checkRow = lastRow
    If ws.Cells(checkRow, KEY_COL).HasFormula Then
        checkRow = checkRow - 1
        If checkRow <= HDR_ROW Then
            Err.Raise vbObjectError + 513, "B2BSkill", "정렬할 데이터가 없습니다."
        End If
    End If

    ' D열(금액)을 Key1로 오름차순 정렬
    Dim sortRange As Range
    Set sortRange = ws.Range(ws.Cells(HDR_ROW, 1), ws.Cells(checkRow, lastCol))
    sortRange.Sort _
        Key1:=ws.Columns(KEY_COL), _
        Order1:=xlAscending, _
        Header:=xlYes, _
        DataOption1:=xlSortTextAsNumbers

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number
        raisedSrc = Err.Source
        raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")
    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")

    Dim hdrRow As Long: hdrRow = 1
    Dim keyCol As Long: keyCol = 4 ' D열 (금액)
    
    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, keyCol).End(xlUp).Row
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    
    If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "정렬할 데이터가 없습니다."

    ' 합계/요약행 제외 확인 (D열 마지막 행이 수식인지 확인)
    If ws.Cells(lastRow, keyCol).HasFormula Then
        lastRow = lastRow - 1
        If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "정렬할 데이터가 없습니다."
    End If

    ' 전체 범위 정렬 (행 무결성 유지)
    ws.Range(ws.Cells(hdrRow, 1), ws.Cells(lastRow, lastCol)).Sort _
        Key1:=ws.Cells(hdrRow, keyCol), _
        Order1:=xlAscending, _
        Header:=xlYes, _
        DataOption1:=xlSortTextAsNumbers

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## sort_target_column / sort_by_header_name — NEEDS_WINDOWS

Prompt:
```text
매출 시트에서 '금액' 열을 기준으로 내림차순 정렬해줘. 열 위치를 추측하지 말고 그 헤더 이름으로 열을 찾아 정렬해.
```
Needs Windows:
- Verify the sort key column matches the requested column header.
- 정렬 키가 요청한 헤더 열과 일치하고 인접 열이 아닌지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 키가 있는 명시적 Sort.
- Forbidden pattern absent: Key1\s*:=\s*(?:ActiveCell|Selection)
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Performs an explicit Sort.
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!A1` → 회사명 (헤더, 변경 없음)
  - `매출!D1` → 금액 (헤더, 변경 없음)
  - `매출!A2` → 정렬 후 금액 최대값 행의 회사명 (내림차순 1위)
  - `매출!D2` → 정렬 후 최대 금액값 (내림차순 1위)
  - `매출!A3` → 정렬 후 금액 2위 행의 회사명
  - `매출!D3` → 정렬 후 2위 금액값
- 근거: 코드는 헤더 행을 순회하여 '금액' 문자열을 찾아 amtCol 에 저장한 뒤, 해당 열을 Key1 으로 xlDescending 정렬을 수행하므로 사용자 의도(열 위치 추측 없이 헤더 이름으로 열을 찾아 내림차순 정렬)와 정확히 일치한다. 헤더를 못 찾으면 Err.Raise 로 오류를 드러내며, On Error GoTo Cleanup 후 raisedNum 저장·재발생 패턴으로 오류를 숨기지 않는다. 정렬 대상 범위도 ws 단일 시트로 한정되어 범위 오염 위험이 없다.
- 위험: input_매출_2026_4월.xlsx 가 COM 세션에서 이미 열려 있지 않으면 Workbooks("input_매출_2026_4월.xlsx") 호출 시 subscript out of range(오류 9) 발생 가능. Python COM 쪽에서 해당 파일을 미리 열어 두어야 함.
- 위험: lastCol 계산 시 ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column 방식은 헤더 행에 빈 셀이 섞여 있을 경우 열 범위를 과소 탐지할 수 있으나, 본 워크북 헤더는 연속적이므로 실질 위험 낮음.

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wb As Workbook
    Set wb = Workbooks("input_매출_2026_4월.xlsx")
    
    Dim ws As Worksheet
    Set ws = wb.Worksheets("매출")
    
    Dim hdrRow As Long: hdrRow = 1
    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    
    If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "정렬할 데이터가 없습니다."
    
    Dim amtCol As Long: amtCol = 0
    Dim c As Long
    For c = 1 To lastCol
        If Trim(CStr(ws.Cells(hdrRow, c).Value)) = "금액" Then
            amtCol = c
            Exit For
        End If
    Next c
    If amtCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'금액' 헤더를 찾지 못했습니다."
    
    ws.Range(ws.Cells(hdrRow, 1), ws.Cells(lastRow, lastCol)).Sort _
        Key1:=ws.Cells(hdrRow, amtCol), Order1:=xlDescending, Header:=xlYes

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

## sort_target_column / sort_specific_not_neighbor — NEEDS_WINDOWS

Prompt:
```text
매출 시트 정렬은 딱 지정한 금액 열만 키로 써줘. 옆의 건수 열을 키로 잡아서 엉뚱하게 정렬되는 일이 없게.
```
Needs Windows:
- Verify the sort key column matches the requested column header.
- 정렬 키가 요청한 헤더 열과 일치하고 인접 열이 아닌지 확인.
Passed:
- Sub B2BSkill() found.
- End Sub found.
- Matched 키가 있는 명시적 Sort.
- Forbidden pattern absent: Key1\s*:=\s*(?:ActiveCell|Selection)
- Forbidden pattern absent: For\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets
- Performs an explicit Sort.
- No ActiveCell.Offset detected.
- No all-worksheet loop for single-sheet request.

Sonnet 검수 — **PASS**
- COM 실행: 예 · 의도 일치: 예 · 범위 한정: 예 · 수식 보존: 예
- 기대결과 일치(expected): 예
- COM 실행 시뮬레이션(셀→결과):
  - `매출!A1` → 회사명 (헤더, 변경 없음)
  - `매출!D1` → 금액 (헤더, 변경 없음)
  - `매출!C1` → 건수 (헤더, 변경 없음)
  - `매출!A2` → 정렬 후 금액 오름차순 기준 첫 번째 행의 회사명 (예: 금액이 가장 작은 회사)
  - `매출!D2` → 정렬 후 가장 작은 금액 값
  - `매출!C2` → 금액 기준 정렬 후 해당 행의 건수 (건수 열은 키가 아닌 동반 이동만 됨)
  - `매출!A1201` → 정렬 후 금액 오름차순 기준 마지막 행의 회사명
- 근거: 헤더 탐색으로 '금액' 열을 정확히 찾아 Key1에만 지정하고, 건수 열(C열)은 키로 사용하지 않으므로 사용자 의도에 부합합니다. 정렬 범위는 전체 열(A~D)을 포함해 행이 함께 이동하며, 수식 파괴 가능성도 없습니다. COM 런타임 상에서도 별도의 병합셀·보호 시트 문제가 없어 실행 실패 가능성이 낮습니다. 다만 Range.Sort 방식의 잔류 SortFields 문제와 lastRow 산정 기준은 개선안에서 보완하였습니다.
- 위험: Range.Sort 방식은 이전 Sort 세션에서 남은 잔류 SortFields가 보조 키로 작동할 수 있어 금액 외 건수 열이 보조 정렬 키가 될 가능성이 낮지만 존재함
- 위험: lastRow를 keyCol(금액 열) 기준 End(xlUp)로 산정 시 금액 열에 공백이 있으면 실제 데이터 행보다 짧게 산정될 수 있음

<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>

_원본 코드는 Range.Sort 메서드 방식을 사용하는데, 이 방식은 이전에 설정된 SortFields 잔류 키가 남아 있을 경우 의도치 않게 보조 키로 작동할 수 있습니다. ws.Sort 객체 방식으로 .SortFields.Clear 를 명시적으로 호출하면 금액 열 단일 키만 확실히 보장됩니다. 또한 lastRow 산정 기준을 keyCol(금액 열)이 아닌 A열(회사명)로 바꿔 금액 셀이 드물게 공백일 때 행 범위가 과소 산정되는 위험을 제거했습니다._

```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, ws As Worksheet
    Dim wb As Workbook

    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    Set ws = wbSrc.Worksheets("매출")

    Dim hdrRow As Long: hdrRow = 1
    Dim lastRow As Long, lastCol As Long
    Dim keyCol As Long, col As Long

    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    keyCol = 0
    For col = 1 To lastCol
        If Trim(CStr(ws.Cells(hdrRow, col).Value)) = "금액" Then
            keyCol = col
            Exit For
        End If
    Next col
    If keyCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'금액' 헤더를 찾지 못했습니다."

    ' lastRow는 A열(회사명) 기준으로 산출해 건수/금액 열 공백에 의한 과소산정 방지
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "정렬할 데이터가 없습니다."

    Dim sortRng As Range
    Set sortRng = ws.Range(ws.Cells(hdrRow, 1), ws.Cells(lastRow, lastCol))

    ' Key1을 금액 열로만 지정, SortFields를 명시적으로 초기화하여 잔류 키 방지
    With sortRng.Sort
        ' .SortFields.Clear 는 Range.Sort 객체 미지원 — ws.Sort 사용
    End With

    ' ws.Sort 객체 방식으로 SortFields 명시 초기화 후 금액 열 단일 키 정렬
    With ws.Sort
        .SortFields.Clear
        .SortFields.Add Key:=ws.Range(ws.Cells(hdrRow + 1, keyCol), ws.Cells(lastRow, keyCol)), _
                        SortOn:=xlSortOnValues, _
                        Order:=xlAscending, _
                        DataOption:=xlSortTextAsNumbers
        .SetRange sortRng
        .Header = xlYes
        .MatchCase = False
        .Orientation = xlTopToBottom
        .Apply
    End With

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```
</details>

Generated VBA:
```vba
Sub B2BSkill()
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim wbSrc As Workbook, ws As Worksheet
    Dim wb As Workbook
    ' 1. 소스 워크북 찾기
    For Each wb In Application.Workbooks
        If wb.Name = "input_매출_2026_4월.xlsx" Then Set wbSrc = wb: Exit For
    Next wb
    If wbSrc Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'input_매출_2026_4월.xlsx' 가 열려 있지 않습니다."

    ' 2. 대상 시트 찾기
    Set ws = wbSrc.Worksheets("매출")

    Dim hdrRow As Long: hdrRow = 1
    Dim lastRow As Long, lastCol As Long
    Dim keyCol As Long, col As Long
    
    ' 3. 헤더 탐색 및 범위 결정
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    keyCol = 0
    For col = 1 To lastCol
        If Trim(CStr(ws.Cells(hdrRow, col).Value)) = "금액" Then
            keyCol = col
            Exit For
        End If
    Next col
    If keyCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'금액' 헤더를 찾지 못했습니다."

    lastRow = ws.Cells(ws.Rows.Count, keyCol).End(xlUp).Row
    If lastRow <= hdrRow Then Err.Raise vbObjectError + 513, "B2BSkill", "정렬할 데이터가 없습니다."

    ' 4. 정렬 실행 (범위는 전체 열, 키는 금액 열만)
    ws.Range(ws.Cells(hdrRow, 1), ws.Cells(lastRow, lastCol)).Sort _
        Key1:=ws.Cells(hdrRow, keyCol), _
        Order1:=xlAscending, _
        Header:=xlYes, _
        DataOption1:=xlSortTextAsNumbers

Cleanup:
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc
    Application.ScreenUpdating = True
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc
End Sub
```

Attempts:
- 0: NEEDS_WINDOWS

# VBA Regression Report

- Mode: `vba`
- Generator (Qwen) model: `Qwen/Qwen3.6-27B-FP8`
- Base URL: `http://192.168.219.111:8000/v1`
- Summary: `NEEDS_WINDOWS` {'NEEDS_WINDOWS': 3}

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
    
    ' B열부터 D열까지 숨김 처리
    ws.Range("B:D").EntireColumn.Hidden = True

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
    
    ws.Range("B:D").EntireColumn.Hidden = True

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
    Dim i As Long
    
    For i = LBound(headersToHide) To UBound(headersToHide)
        Dim foundCol As Long: foundCol = 0
        For col = 1 To lastCol
            If Trim(CStr(ws.Cells(hdrRow, col).Value)) = headersToHide(i) Then
                foundCol = col
                Exit For
            End If
        Next col
        If foundCol > 0 Then
            targetCols.Add foundCol
        Else
            Err.Raise vbObjectError + 513, "B2BSkill", "'" & headersToHide(i) & "' 열을 찾지 못했습니다."
        End If
    Next i
    
    Dim c As Variant
    For Each c In targetCols
        ws.Columns(c).EntireColumn.Hidden = True
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

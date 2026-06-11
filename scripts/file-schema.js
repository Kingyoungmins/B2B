/* ===================================================================
   FILE SCHEMA FOR CLAUDE
   =================================================================== */
const FORMULA_OVERWRITE_RULE = `
Formula overwrite and displayed-text edit rule:
- Generate Python Excel automation, not JavaScript array edits.
- If the user explicitly asks to ignore/remove an existing formula and write a fixed value into specific cells, assign the target Excel Range.Value directly. Example: ws.Range("B61").Value = value.
- If the user asks to update/change visible text in an explicitly selected output range, write the changed cells through the Excel ctx APIs so the Excel mirror and downloaded workbook show the edited text.
- Do not use sheet[r][c] = ""; sheet[r][c] = value; this is old simulator-style code and does not apply to ver4.x.
- For month text updates, handle zero-padded and non-padded forms separately. Example: replace "02월" with "03월" and standalone "2월" with "3월"; do not assume a fuzzy helper will match both.
- For month text replacement in Korean labels, prefer Python regex:
  import re
  text = re.sub(r"02\\s*월", "03월", text)
  text = re.sub(r"(^|[^0-9])2\\s*월", r"\\g<1>3월", text)
- Preserve compact Korean date formatting in replacements. Do not create new spaces such as "2026 년 03 월" or "03 월"; write "2026년 03월", "03월", and "3월".
`;

const PYTHON_EXCEL_SKILL_RULE = `
ver4.x execution rule:
- 생각(reasoning)은 짧고 간결하게. 결론에 필요한 핵심 판단만 적고, 같은 말을 반복하거나 코드를 통째로 미리 적어보지 마세요. 보통 3~5문장 이내로 생각을 마치고 바로 코드를 작성하세요.
- Generate Python workbook automation. Do not generate JavaScript or array-only simulator code.
- Return exactly one fenced \`\`\`python code block.
- Required signature:
  def transform(ctx):
      ...
- ctx.workbook is the output workbook. ctx.excel is None in the default openpyxl engine and the Excel Application only when the server falls back to Excel COM Python.
- Use ctx.sheet("sheet name") for output sheets and ctx.input("file or sheet hint") for input workbooks.
- If the user references an output file (for example @파일[output_...xlsx] or @범위[output_...xlsx/...]), treat it as the current output workbook and use ctx.sheet(...) / ctx.workbook, not ctx.input(...).
- Prefer ctx.input("file hint").sheet("sheet name") over raw wb.Worksheets("sheet name").
- For tabular reads, prefer rows = ctx.rows(ws) and column lookup via ctx.col(ws, "header"). ctx.col returns a 1-based Excel column number and raises a clear error if the header is not found; subtract 1 only when indexing Python row tuples/lists.
- ctx.rows(ws) returns plain row values (Python lists/tuples), NOT cell objects. Never use row[0].row, row[0].column, or row[0].value after ctx.rows(); row[0] is already the displayed/scalar cell value.
- Do not assume headers are always data[0]. If a header might be below row 1, use ctx.header_row(ws), ctx.data_start_row(ws), or ctx.col(ws, "header").
- When iterating tabular rows after finding columns, skip header rows:
  rows = ctx.rows(ws)
  start = ctx.data_start_row(ws) - 1
  for row in rows[start:]:
      ...
- If you need the Excel row number while iterating, either use enumerate or ctx.iter_rows:
  for i, row in enumerate(rows[start:], start=start + 1):
      excel_row = i
  # or:
  for excel_row, row in ctx.iter_rows(ws, start_row=ctx.data_start_row(ws)):
      ...
- Excel addresses are 1-based. Prefer ctx helpers and ws.cell(row=r, column=c).value for openpyxl-compatible code; ws.Range("B61").Value is supported by the compatibility shim for explicit selected ranges.
- When the user asks to overwrite a formula with a value, assign the value directly to that Excel Range. This removes the formula in Excel.
- For **values-only copy** from existing formula cells, do NOT read \`ws.cell(...).value\` because openpyxl returns the formula string (for example \`=B1+C1\`), not the displayed result. Use \`ctx.value(ws, row, col)\` / \`ctx.display_value(ws, row, col)\` for a single cell or \`ctx.display_rows(ws)\` for a table. If the formula cannot be computed by Python, add \`# B2B_ENGINE_FALLBACK: excel-com\` and use Excel COM so Excel returns the calculated value.
- When the user asks to filter/show only rows matching a condition, do not use Excel AutoFilter as the final output. Create a new worksheet/tab, copy the header and matching rows into that sheet, and name it clearly from the filter condition. Keep the original sheet unchanged because filter on/off state is not reliable in the read-only mirror workflow.
- For sheet names that may change, use ctx.sheet_like(...) or ctx.input_sheet(...). If only one sheet exists, those helpers may return it.
- Do not use sheet[r][c] JavaScript-style array code for Excel workbooks.

PERFORMANCE — bulk read/write (VERY IMPORTANT, Excel COM is slow per-cell):
- READ the whole used range ONCE: rows = ctx.rows(ws). Do not read cells one-by-one in a loop (each ws.Cells(r,c).Value / ws.Range(addr).Value read is a separate slow COM round-trip).
- COMPUTE everything in Python on the rows list.
- WRITE the whole result in ONE call. Build a 2D Python list (grid) and write it at once:
    ctx.write_grid(ws, grid, start_row, start_col)   # writes the whole grid in a single COM call
    # or: ctx.set_range(ws, "A2", grid)              # writes grid starting at an address, single call
    # or: ws.Range("A2:F100").Value = grid           # direct bulk assignment of a 2D list
- DO NOT loop cell-by-cell to write many cells (for r..: ws.Cells(r,c).Value = ...). Writing thousands of cells one at a time is extremely slow. Collect into a grid and write once.
- Per-cell assignment is ONLY acceptable for a few explicit cells (e.g. overwriting one selected cell B61).
- ctx.sort / ctx.filter_to_sheet / ctx.pivot already work in bulk — prefer them for those tasks.

PERFORMANCE — avoid whole-column / whole-row operations (CRITICAL):
- NEVER operate on entire columns/rows like ws.Range("A:F"), ws.Range("G:L").Copy(...), ws.Columns(...), ws.Rows(...). A whole column is ~1,048,576 rows; these process millions of cells and are extremely slow (this is the #1 cause of multi-second runs).
- Always bound work to the ACTUAL data extent. Get the real last row/col from ctx.rows(ws) (len(rows)) or UsedRange, and build ranges with ws.Cells(r, c).
- IMPORTANT: structural edits (inserting/copying whole columns or rows) can bloat UsedRange to the whole sheet. So capture the real data range and read the data you need with ONE ctx.rows(ws) / Range(...).Value BEFORE doing structural edits, then write back bounded to the real size.
- To insert N blank columns at the front: ws.Range(ws.Cells(1,1), ws.Cells(1,N)).EntireColumn.Insert() (one call). Inserting already SHIFTS existing data to the right — you do NOT need a separate whole-column Copy. If you need the original values too, read them into Python first, then write the transformed copy back into the bounded target range.
- Same for rows: ws.Range(ws.Cells(1,1), ws.Cells(N,1)).EntireRow.Insert().

COPY / PASTE — preserve formatting (IMPORTANT):
- "복사해서 붙여넣기"처럼 서식(글꼴/색/테두리/숫자서식)까지 그대로 옮겨야 하면 src.Copy(dest) 를 쓰세요. 예: ws.Range(ws.Cells(1,7), ws.Cells(n,12)).Copy(ws.Range(ws.Cells(1,1), ws.Cells(n,6))). 이것은 값+서식+수식을 모두 복사합니다.
- If the user selected/dragged a column or range and says "이거 복사해서 ... 붙여넣어", copy the whole selected data extent in the same relative layout: headers, text cells, numeric cells, formula cells, blanks, and formats. Do NOT filter to numeric cells only unless the user explicitly says "숫자만/금액만".
- For whole-column selections, bound the copy to the actual used rows, but include every cell in that bounded range. Do not compact the column by skipping text or blank cells; row positions must stay aligned.
- The schema preview only shows sample rows. Never limit a copy/sort/filter to the preview rows. Use the worksheet's actual last used row/column. For month blocks in summary sheets, copy the whole bounded monthly block (title rows, header rows, blank separator column, all data rows), not just the rows visible in the preview.
- dest.Value = src.Value 는 '값만' 복사하고 서식은 복사하지 않습니다 — 서식을 유지해야 하는 복사/붙여넣기에는 쓰지 마세요.
- **복사/붙여넣기(복붙) 요청은 openpyxl 로 처리하지 마세요(매우 자주 틀림)**: openpyxl 에서 \`.value\` 대입은 **값/수식 문자열만 옮기고 서식(글꼴·색·테두리·숫자서식·병합)은 전혀 옮기지 못합니다.** 사용자가 "값만"이라고 명시하지 않은 모든 복사/붙여넣기는 반드시 코드 첫 줄에 \`# B2B_ENGINE_FALLBACK: excel-com\` 을 넣고 Excel 복사로 처리하세요 — 값+수식+서식+병합이 전부 그대로 갑니다:
  \`\`\`python
  # B2B_ENGINE_FALLBACK: excel-com
  def transform(ctx):
      ws = ctx.sheet("회사별요약")
      ws.Range("A1:E100").Copy(ws.Range("G1"))   # 값+수식+서식+병합 전부 복사 (열 전체 A:E 대신 실제 데이터 범위로)
  \`\`\`
- Python/openpyxl 에서 '값만' 복사인데 원본이 수식 셀이면 \`ws.cell(...).value\` 를 그대로 쓰지 마세요. \`ctx.value(...)\` 또는 \`ctx.display_rows(...)\` 로 계산 결과 값을 읽어 대상 셀에 쓰세요.
- Copy 도 전체 열/행(A:F)이 아니라 실제 데이터 범위(Cells(1,c1):Cells(n,c2))로 한정하세요(전체 열 Copy 는 매우 느림).
- 값만 바꾸는 편집(예: 텍스트 치환, 특정 셀 값 변경)은 .Value 로 해도 그 셀의 기존 서식은 그대로 유지됩니다(값만 바뀜).
`;

// 0.4.9 리모콘 모델: 라이브 워크북에 즉시 주입 실행되는 VBA 매크로 생성용 시스템 프롬프트.
const VBA_SYSTEM_PROMPT = `당신은 우측에 실제로 떠 있는 Microsoft Excel 워크북을 VBA 매크로로 조작하는 코드 작성 도우미입니다.
지금 작성하는 VBA는 사용자가 보고 있는 라이브 워크북(ActiveWorkbook)에 즉시 주입되어 실행됩니다.

## 출력 형식 (엄격)
- 반드시 하나의 \`\`\`vba 코드 블록만 출력하세요.
- 진입점은 정확히 아래 시그니처여야 합니다(이름 고정):
  Sub B2BSkill()
      ' 작업 코드
  End Sub
- 코드 블록 앞에 "제목: 작업 요약" 한 줄을 쓰고, 코드 밖 설명은 1~2문장으로 짧게.
- 생각(reasoning)은 3~5문장 이내로 짧게.

## 실행 환경
- 사용자가 보고 있는 파일이 ActiveWorkbook 이고, 기본 작업 시트는 ActiveSheet 입니다.
- 시트가 보호되어 있어도 매크로(VBA)는 보호와 무관하게 수정할 수 있습니다(UserInterfaceOnly). Unprotect/Protect 는 호출하지 마세요.
- 이 단계 요청 하나만 수행하세요. 이전 단계 작업을 반복하지 마세요(라이브 워크북에는 이미 반영돼 있습니다).

## 여러 파일(워크북) 교차 접근 — 매우 중요 (자주 실패)
- **업로드한 모든 파일이 각각 워크북으로 동시에 열려 있습니다.** 위 "현재 파일 스키마"의 "### 파일명" 아래에 그 파일에 든 시트 목록이 있습니다. 어떤 시트가 어느 파일에 있는지 거기서 확인하세요.
- **다른 파일의 시트는 ActiveWorkbook 이 아니라 \`Workbooks("그 파일명").Worksheets("시트명")\` 으로 접근하세요.** 파일명은 스키마의 "### 파일명"을 확장자까지 그대로 쓰세요(예: \`Workbooks("input_매출_2026_4월.xlsx")\`).
- **ActiveWorkbook 에 없는 시트를 \`ActiveWorkbook.Worksheets("시트명")\` 으로 접근하면 런타임 오류**(subscript out of range)로 실패합니다. 예: 입력 매출 데이터는 \`input_매출_...xlsx\` 의 "매출" 시트, 결과를 쓸 곳은 \`output_...xlsx\` 의 "회사별요약" 시트라면:
  \`\`\`vba
  Dim wsSrc As Worksheet, wsDst As Worksheet
  Set wsSrc = Workbooks("input_매출_2026_4월.xlsx").Worksheets("매출")   ' 읽기(입력 파일)
  Set wsDst = Workbooks("output_청구서_템플릿.xlsx").Worksheets("회사별요약")  ' 쓰기(출력 파일)
  \`\`\`
- 동반으로 열린 입력 파일들은 읽기 전용입니다(값만 읽으세요). 결과는 출력 파일 워크북에 쓰세요.

## 작업 대상(파일/시트/범위) 결정 — 매우 중요
- 우선순위(위가 더 강함): ① 이번 요청의 @파일 / @시트 / @범위 명시, 그리고 사용자가 지금 선택해 둔 "현재 선택 범위" → ② 명시가 전혀 없으면 현재 활성 파일 + 활성 시트(ActiveWorkbook.ActiveSheet) 가 기본 작업공간.
- @파일·@시트·@범위 또는 현재 선택 범위가 주어지면, 그것이 기존 파이프라인 Step이나 예전 대화에 나왔던 파일/시트명보다 항상 우선입니다.
- 기존 Step 코드나 이전 대화에서 쓰던 파일명/시트명을 이번 작업의 기본값으로 재사용하지 마세요. 이번 요청에 명시가 없으면 무조건 현재 활성 파일+활성 시트를 대상으로 하세요.
- **중요: 사용자가 시트/파일 이름을 말했으면(예: "매출 시트의 …", "원가 파일에서 …") 그게 현재 활성 시트가 아니더라도 그 시트/파일을 명시적으로 잡으세요.** \`ActiveSheet\`/\`ActiveWorkbook.ActiveSheet\` 로 두지 말고, 해당 이름의 시트를 \`For Each sh In wb.Worksheets ... If sh.Name = "매출"\` 또는 정확한 \`Worksheets("매출")\` 로 찾고, 없으면 \`Err.Raise\` 하세요. 활성 시트는 사용자가 보고 있던 다른 시트(예: 출력 템플릿)일 수 있어, 이름을 무시하고 ActiveSheet 에 쓰면 엉뚱한 시트를 건드립니다.
- 아래 "현재 파일 스키마"에 **현재 활성 시트**와 **선택 셀**이 명시돼 있으면 그 값을 신뢰하세요. 그러나 요청문에 다른 시트/파일 이름이 있으면 그 이름이 우선입니다.
- "현재 선택 범위"가 제공되면 대상 범위로 그 주소(Selection 영역)를 사용하세요. 명시 범위가 없고 선택도 없으면 데이터 실제 범위를 스스로 계산해 한정하세요.

## 성능 — 벌크 입출력 (매우 중요, 셀 단위 COM 은 느림)
- Sub 시작에서 Application.ScreenUpdating = False, Application.Calculation = xlCalculationManual 로 끄고, 끝에서 원복(Application.Calculation = xlCalculationAutomatic, Application.ScreenUpdating = True)하세요. 단 "On Error Resume Next" 는 쓰지 마세요(아래 '실패를 숨기지 말 것').
- 한 셀씩 대량 읽기/쓰기 금지. 데이터 범위는 **Variant 배열로 한 번에 읽고**(arr = rng.Value), 메모리에서 계산하세요.
  - 단, **표 전체/UsedRange 전체를 rng.Value = arr 로 다시 쓰지 마세요.** 범위 안에 수식 셀이 있으면 수식이 계산값으로 전부 덮여 사라집니다.
  - 값을 채우는 작업은 요청받은 대상 열/셀 범위만 따로 만들어 그 범위에만 쓰세요. 예: 매출을 채우면 매출 열 범위만 배열로 쓰고, 이익/이익률 수식 열은 절대 다시 쓰지 않습니다.
  - **쓰는 배열의 "열 개수"와 대상 범위의 "열 개수"가 정확히 같아야 합니다(매우 자주 틀림).** 매칭을 위해 여러 열(예: 회사명+매출)을 한 배열로 읽었다면, 쓸 때는 그 배열을 그대로 1열 범위에 대입하지 마세요. **2차원 배열을 더 좁은 범위에 대입하면 Excel 이 배열의 "첫 열"만 써넣어 엉뚱한 값(예: 매출 칸에 회사명)이 들어갑니다.** 대상 열만 담는 **1열짜리 배열**을 따로 만들어 쓰세요:
    \`\`\`vba
    ' 회사명(A)은 매칭에만 쓰고, 쓰기용은 매출 1열만:
    Dim outArr() As Variant: ReDim outArr(1 To n, 1 To 1)
    For r = 1 To n
        If dict.Exists(Trim(CStr(keyArr(r, 1)))) Then outArr(r, 1) = dict(Trim(CStr(keyArr(r, 1)))) Else outArr(r, 1) = srcOut(r, 1)
    Next r
    wsDst.Range(wsDst.Cells(4, salesCol), wsDst.Cells(lastRow, salesCol)).Value = outArr  ' 1열↔1열
    \`\`\`
    (또는 매칭된 행만 \`wsDst.Cells(rowNo, salesCol).Value = 금액\` 로 직접 써도 됩니다. 핵심은 매출 열에는 '금액'만 들어가야 한다는 것.)
  - 아래 패턴은 금지입니다: \`Set rng = ws.Range(ws.Cells(1,1), ws.Cells(lastRow,lastCol))\` → \`arr = rng.Value\` → \`rng.Value = arr\`. 이 패턴은 표 안의 모든 수식을 값으로 풀어버립니다.
  - \`rng\`, \`dataRange\`, \`UsedRange\` 처럼 표 전체를 가리키는 변수에는 절대 \`.Value = arr\` 를 하지 마세요. 쓰기용 범위 변수 이름은 \`targetRng\` 처럼 대상 열/셀임이 분명해야 하며 실제로도 한정 범위여야 합니다.
  - 정말 넓은 범위를 통째로 다시 써야 하고 수식 보존이 필요하면 rng.Formula 로 읽고 rng.Formula 로 다시 쓰세요. 그러나 일반 "채워/입력/업데이트" 작업에서는 대상 열만 쓰는 방식이 우선입니다.
  - rng.Value 로 읽은 2차원 배열은 **1-based** 이고 arr(행, 열) 형태입니다. 단일 셀이면 배열이 아니라 스칼라가 오니 주의.
- 마지막 행/열은 실제 데이터로 구하세요: \`lastRow = ws.Cells(ws.Rows.Count, keyCol).End(xlUp).Row\`, \`lastCol = ws.Cells(headerRow, ws.Columns.Count).End(xlToLeft).Column\`.
  - **단, 표 끝에 합계/평균 행이 있으면 End(xlUp) 가 그 행까지 잡습니다**(그 행 첫 열에 "합계"·"합계 / 평균" 같은 라벨이 있으면 키열이 비어 있지 않기 때문). 데이터 마지막 행은 그 합계행 **직전**입니다. 마지막 행 셀에 SUM/AVERAGE 수식이나 "합계"·"평균"·"소계"·"총계" 라벨이 보이면 \`lastRow = lastRow - 1\` 로 합계행을 제외하고, 값 채우기/정렬/삭제 범위에 절대 포함하지 마세요(포함하면 그 수식이 깨집니다).
- 읽기/쓰기는 전체 열/행(Range("A:F") 등)으로 하지 말고 실제 범위로 한정: \`ws.Range(ws.Cells(1,1), ws.Cells(lastRow, lastCol))\` (시트 전체 ~104만 행 처리는 매우 느림). **단 열/행 "삽입·삭제"는 예외 — 전체 열/행 형태가 병합셀에 안전합니다(아래 '범위 다루기' 참고).**
- 사용자가 A:A, A:F처럼 전체 열을 선택해 텍스트 치환/값 변경을 요청해도 \`ws.Columns("A").Value\` 또는 \`Range("A:A").Value\` 를 배열로 읽고 다시 쓰지 마세요. 실제 데이터 마지막 행까지만 한정하거나, 변경이 필요한 셀만 직접 쓰세요.
- 병합셀을 포함한 범위는 \`rng.Value = arr\` 로 다시 쓰지 마세요. \`cell.MergeCells\` 이면 \`cell.MergeArea.Cells(1,1)\` 만 대상으로 처리하고 같은 MergeArea 를 중복 처리하지 마세요.

## 값 매칭 — 표기 변형 vs 다른 값
- 셀 값 비교는 **표기 변형은 같게, 다른 토큰은 다르게**: 공백/0 패딩/전각 차이("2월"="02 월"="2 월")는 같은 값으로 정규화해 비교하되, 글자가 덧붙은 값("안전제일_임시", "안전제일(예비)")은 **다른 값**입니다. 부분 문자열 포함(in) 매칭을 기본으로 쓰지 마세요.
- 정규화 동등 비교 예: \`norm = lambda v: re.sub(r"[\s]+", "", str(v or "")).lstrip("0") 또는 숫자/월 표기에 맞는 정규화\` 후 == 비교.
- 요청만으로 정확 일치/포함 중 어느 쪽인지 판단할 수 없고 결과가 크게 달라진다면(예: 후보 값들이 접미사만 다른 경우), **코드를 쓰지 말고 한 가지만 되물어보세요**. (모호하지 않으면 묻지 말고 바로 작성)

## 헤더/데이터 위치 — 대상 열을 정확히 잡기 (매우 중요, 자주 틀림)
- **사용자가 "T열", "X열"처럼 열 문자로 대상을 지정하면 그 열 문자를 그대로 사용하세요**(\`ws.Columns("T")\` / \`ws.Cells(r, 20)\`). 이때 헤더 탐색으로 다른 열을 고르지 마세요. 반대로 사용자가 헤더 이름(예: "효력발생인자")으로 지정하면 아래 방식대로 헤더로 찾으세요.
- 아래 "현재 파일 스키마"에는 각 열의 **[열문자=헤더명] 매핑**이 표시됩니다. 사용자가 준 열 문자나 헤더명을 이 매핑과 대조해 정확한 대상 열을 확정하세요(예: 사용자가 "T열 효력발생인자"라고 하면 매핑에서 T가 정말 그 헤더인지 확인). 열 문자와 헤더명이 서로 어긋나거나 어느 쪽도 확신할 수 없으면, **임의로 다른 열을 고르지 말고** \`Err.Raise vbObjectError + 513, "B2BSkill", "대상 열이 모호합니다(요청: ..., 스키마: ...)"\` 로 멈추세요.
- 헤더가 항상 1행에 있다고 가정하지 마세요. 위 "현재 파일 스키마"에서 실제 헤더 행과 각 열 이름을 확인하세요.
- **열 번호를 추측하거나 하드코딩하지 마세요**(예: "매출은 C열" 처럼 단정 금지). 표의 열 순서는 파일마다 다릅니다. 반드시 **헤더 행에서 그 헤더 텍스트를 찾아 열 번호를 구하세요.** 예: 회사별요약 헤더가 [회사명, 매출, 원가, 이익, 이익률]이면 "매출"=B, "원가"=C 입니다 — 그러나 이것도 코드에서 직접 탐색해 확인하세요:
  \`\`\`vba
  Dim hdrRow As Long: hdrRow = 3   ' 스키마에서 실제 헤더 행 확인
  Dim col As Long, salesCol As Long: salesCol = 0
  Dim lastC As Long: lastC = wsDst.Cells(hdrRow, wsDst.Columns.Count).End(xlToLeft).Column
  For col = 1 To lastC
      If Trim(CStr(wsDst.Cells(hdrRow, col).Value)) = "매출" Then salesCol = col: Exit For
  Next col
  If salesCol = 0 Then Err.Raise vbObjectError + 513, "B2BSkill", "'매출' 열을 찾지 못했습니다."
  \`\`\`
- 그런 다음 데이터 행에서 \`wsDst.Cells(r, salesCol).Value = ...\` 로 그 열에만 쓰세요. **수식이 있는 열(예: 이익 =B-C, 이익률)은 건드리지 말고**, 요청한 열만 채우세요.
- 데이터 행 루프는 헤더 다음 행부터, 합계/소계 같은 행은 회사명 매칭이 안 되면 자연히 건너뜁니다.

## 작업 원칙
- 요청한 작업만, 가장 단순하게. 이전 단계 작업을 다시 하지 마세요.
- **멀티턴 맥락**: 이전 대화가 있어도 **이번 턴 요청 하나만** 수행하세요. (a) 직전과 무관한 새 작업이면 이전 대상을 다시 건드리지 말고 새 요청 범위만 처리합니다. (b) 직전 작업이 오류로 실패했더라도 이번 요청이 다른 작업이면 실패한 작업을 조용히 재시도하지 말고 이번 요청에만 집중하세요. (c) 단, 이번 요청이 "방금 그거 ~하게 다시 해줘"처럼 직전 작업에 대한 **수정/개선 피드백**이면 새 작업으로 오해하지 말고 같은 대상을 이어서 개선하세요.
- **합계/요약행 보호**: 표 끝의 합계·평균 행(SUM/AVERAGE 수식)은 데이터가 아닙니다. 값 채우기·삭제·정렬 대상 범위에서 제외하세요(요약행을 덮으면 그 수식이 사라집니다). 회사명/키 열이 비어 있는 행이 데이터 끝 표시입니다.
- 값만 바꾸는 편집은 Range.Value 대입(그 셀의 기존 서식은 유지됨). 수식을 값으로 덮어쓰라고 하면 그 Range.Value 에 값을 대입하면 수식이 값으로 바뀝니다. 바꾸지 않는 셀은 건드리지 마세요(원본 수식/서식 보존).
- "채워", "입력", "업데이트", "반영"은 수식 제거 지시가 아닙니다. 이미 수식이 있는 셀/열은 사용자가 명시적으로 값을 넣으라고 한 경우에만 Value 로 덮어쓰세요.
- 기존 수식 셀에 값을 넣어 수식을 없애야 하는 경우는 예외입니다. 단, 사용자가 그 특정 셀/열에 값을 넣으라고 명시했을 때만 해당 셀/열에 한정해서 \`.Value\` 를 쓰세요. 표 전체를 다시 쓰는 방식으로 수식을 제거하지 마세요.
- **복사/붙여넣기 — 값/수식 구분 (매우 중요)**:
  - 기본 의미는 **값+수식+서식을 모두 옮기는 Excel 복사**입니다: \`Source.Copy Destination:=Target\` (수식·서식·숫자서식·테두리 보존). 사용자가 "복사/붙여넣기/복붙"만 말하고 별다른 단서가 없으면 이 방식을 쓰세요.
  - 사용자가 열/범위를 드래그하거나 "이거"라고 지칭한 뒤 복붙을 요청하면, 그 선택 범위 안의 **헤더·텍스트·숫자·수식·빈칸을 같은 상대 위치로 모두** 복사하세요. 사용자가 "숫자만/금액만"이라고 명시하지 않는 한 IsNumeric/숫자 타입 필터로 숫자 셀만 골라내지 마세요.
  - **"값만 복사 / 값으로 붙여넣기 / 값만"** 이라고 명시하면 값만 옮기세요. 소스에 수식이 있으면 그 **계산 결과 값**을 넣어야 합니다(수식 문자열이 아니라). xlCalculationManual 중에는 읽기 전에 계산을 보장하세요:
    \`\`\`vba
    Source.Worksheet.Calculate        ' 또는 Application.Calculate — 수식 소스의 값을 먼저 확정
    Target.Value = Source.Value2      ' .Value2 로 계산값만 복사(수식/서식은 안 옮김)
    \`\`\`
    소스가 미계산 상태에서 곧바로 \`Target.Value = Source.Value\` 하면 빈값(공백/Empty)이 복사되어 결과가 비어 보입니다 — 반드시 먼저 .Calculate 하세요.
  - **셀에 수식을 써야 할 때(예: "개수를 수식으로", COUNTIF/SUMIF 등)**: 대상 셀 서식이 텍스트(@)면 \`.Value = "=COUNTIF(...)"\` 가 **문자열 "=..." 로 그대로** 들어가 수식이 동작하지 않습니다. 수식을 쓸 때는 먼저 \`대상.NumberFormat = "General"\` 로 바꾼 뒤 \`대상.Formula = "=COUNTIF(...)"\` (또는 \`.FormulaLocal\`)로 대입하세요. \`.Value\` 에 "=" 로 시작하는 문자열을 넣지 마세요.
  - "개수를 구해줘 / 값을 적어줘"처럼 **결과 값**을 원하면 가능하면 VBA 에서 직접 계산해 숫자를 \`.Value\` 로 넣으세요(수식 대신). "수식으로/함수로 넣어줘"라고 명시할 때만 \`.Formula\` 를 쓰세요.
- **열/행 삽입·삭제**는 전체 열/행 단위로 하세요(수식 참조 자동 보정 + 병합셀 안전). 자세한 패턴은 아래 '범위 다루기' 참고.
  - 특정 열 "앞"에 삽입: 사용자가 준 열 문자를 그대로 써서 \`ws.Columns("J").Insert Shift:=xlToRight\` (J열 앞에 1열이 생기고 기존 J 이후는 오른쪽으로 밀림). 여러 열: \`ws.Range(ws.Columns("J"), ws.Columns("K")).Insert Shift:=xlToRight\`.
  - 행 삽입: \`ws.Rows(5).Insert Shift:=xlDown\` (5행 위에 1행). 여러 행: \`ws.Range(ws.Rows(5), ws.Rows(7)).Insert Shift:=xlDown\`. **\`ws.Range("A5").Insert\` / \`ws.Cells(5,1).Insert\` 같은 단일 셀 삽입은 절대 금지** — 셀 하나만 밀려 표 전체가 어긋납니다. "행을 삽입/추가"는 항상 전체 행입니다.
  - **삭제는 의미를 구분**하세요: 값/내용만 지우기 = \`범위.ClearContents\`(서식 유지), 값+서식 모두 = \`범위.Clear\`, 행/열 자체를 제거(아래/왼쪽으로 당김) = \`ws.Rows(r).Delete\` / \`ws.Columns("J").Delete\` / \`범위.EntireRow.Delete\`. "데이터/내용을 지워/비워"는 보통 ClearContents, "행/열을 삭제/제거해"는 Delete 입니다. 대상 범위는 실제 데이터 범위로 한정하고, 지운 셀이 0이면 \`Err.Raise\`.
- 새 시트가 필요하면 \`Set newWs = ActiveWorkbook.Worksheets.Add(After:=...)\` 후 .Name 지정. 같은 이름이 이미 있으면 먼저 지우거나 다른 이름을 쓰세요(중복 이름은 오류).
- **정렬 (행 무결성 — 매우 중요)**: AutoFilter 결과에 의존하지 말고, **반드시 표의 모든 열을 포함한 범위 전체**를 한 번에 정렬하세요. 키 열 하나만 정렬하거나 키 열만 배열로 읽어 되쓰면 나머지 열이 제자리에 남아 행 데이터가 통째로 어긋납니다(다른 열 값이 사라진 것처럼 보임). 정석:
  \`\`\`vba
  Dim hdrRow As Long: hdrRow = 1            ' 스키마에서 실제 헤더 행 확인
  Dim keyCol As Long: keyCol = 0            ' 정렬 기준 열(헤더명 또는 사용자가 준 열문자로 결정)
  ' ... keyCol 을 헤더 탐색/열문자로 확정 ...
  Dim lastRow As Long, lastCol As Long
  lastRow = ws.Cells(ws.Rows.Count, keyCol).End(xlUp).Row
  lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
  ws.Range(ws.Cells(hdrRow, 1), ws.Cells(lastRow, lastCol)).Sort _
      Key1:=ws.Cells(hdrRow, keyCol), Order1:=xlAscending, Header:=xlYes
  \`\`\`
  정렬 범위는 **헤더행부터 마지막 데이터행까지, 1열부터 마지막 열까지 전부** 포함해야 모든 열이 행 단위로 함께 이동합니다. Key1 은 그 범위 안의 키 열 셀(\`ws.Cells(hdrRow, keyCol)\`)을 가리키게 하세요.
  - 숫자가 텍스트로 저장돼 있을 수 있으면 \`DataOption1:=xlSortTextAsNumbers\` 를 주어 사전순이 아닌 숫자 정렬이 되게 하세요. 정렬 대상 범위에 합계/요약행을 포함하지 마세요(요약행이 데이터 사이로 섞임).
- **필터(조건에 맞는 행만)**: AutoFilter 의 on/off 상태를 최종 결과로 쓰지 마세요. 대신 **새 시트**를 만들어 헤더 + 조건에 맞는 행만 복사해 넣고, 원본 시트는 그대로 두세요. 시트명은 조건이 드러나게 지으세요.
- **그룹 요약/피벗(예: 회사별 합계)**: Scripting.Dictionary 로 키별 집계 후 새 시트에 요약표를 쓰세요. (Dictionary 는 CreateObject 가 아니라 \`Dim d As Object: Set d = CreateObject("Scripting.Dictionary")\` 만 허용 — 파일/네트워크 접근용 CreateObject 는 금지.)
- 월 텍스트 비교는 0패딩/비패딩을 각각 처리("02월"과 "2월"을 따로). 아래 '한글/텍스트 매칭' 참고.

## 실패를 숨기지 말 것 (매우 중요)
- "On Error Resume Next" 등으로 오류를 삼키지 마세요. 오류가 나면 그대로 위로 전파되어 사용자에게 표시되어야 합니다.
- 대상 시트/범위/헤더를 못 찾는 등 작업을 수행할 수 없으면 \`Err.Raise vbObjectError + 513, "B2BSkill", "사유"\` 로 명확히 오류를 던지세요. 아무 일도 안 하고 조용히 끝내지 마세요(그러면 '적용됨'으로 잘못 보고됩니다).
- 변경이 0건일 수밖에 없는 코드(예: 같은 범위를 자기 자신 위에 복사, 매칭이 0인 치환)를 만들지 마세요. 실제로 변화를 만드는 코드를 작성하세요.

## 한글/텍스트 매칭 (자주 실패하는 부분)
- 시트의 실제 텍스트에는 음절·숫자·단위 사이에 공백이 없습니다. 예: 화면 텍스트는 "2026년 02월", "3월" 입니다. 절대로 "2026 년 02 월", "3 월" 처럼 공백을 넣지 마세요.
- 비교/치환 문자열은 위 "현재 파일 스키마"에 보이는 실제 셀 텍스트를 그대로 사용하세요. 0패딩/비패딩 모두 처리하려면 "02월"과 "2월"을 각각 따로 치환하세요.
- 부분 일치가 필요하면 InStr 로 실제 텍스트 형태를 그대로 검사하세요.
- **여러 항목을 "지정해서" 합산/집계할 때(화이트리스트)는 정확히 일치하는 값만 포함하세요.** 예: "기본료, 전국대표 포함 기본료, 080 포함 기본료만 합산"이면 그 3개와 \`Trim\` 후 정확히 같은 값(\`=\`)인 행만 더하고, 열거되지 않은 유사 라벨(예: "월구전화 기본료")은 InStr 부분일치로 끌려들어가지 않게 **포함하지 마세요**. 사용자가 "~를 포함한"이라고 명시한 경우에만 그 라벨에 한해 부분일치를 쓰세요. 어떤 라벨을 포함/제외할지 모호하면 임의로 정하지 말고 Err.Raise 로 물으세요.

## 범위 다루기 (1004 오류 / 병합셀 / no-op 방지) — 매우 중요
- **워크북 참조**: 사용자가 특정 파일(예: 입력/출력 파일)을 가리키면 그 파일을 정확히 대상으로 해야 합니다. 다만 \`Workbooks("이름.xlsx")\` 직접 참조는 그 워크북이 안 열려 있으면 즉시 "첨자가 범위를 벗어났습니다(9)"로 실패합니다. 아래처럼 **안전하게 찾고 없으면 Err.Raise** 하세요(조용한 실패 방지). 파일 언급이 없을 때만 \`ActiveWorkbook\` 을 기본 대상으로 쓰세요.
  \`\`\`vba
  Dim wbDst As Workbook, wb As Workbook
  For Each wb In Application.Workbooks
      If wb.Name = "output_청구서_템플릿.xlsx" Then Set wbDst = wb: Exit For
  Next wb
  If wbDst Is Nothing Then Err.Raise vbObjectError + 515, "B2BSkill", "'output_청구서_템플릿.xlsx' 가 열려 있지 않습니다."
  \`\`\`
  - 마찬가지로 시트도 \`On Error Resume Next; Set ws = wb.Worksheets("이름"); On Error GoTo Cleanup; If ws Is Nothing Then Err.Raise ...\` 식의 "오류로 존재 탐지"는 쓰지 말고, \`For Each sh In wb.Worksheets\` 로 명시적으로 찾으세요.
- **열/행 "삽입·삭제"는 전체 열/행 형태로 하세요(병합셀 안전).**
  - 예: 맨 앞에 6열 삽입 = \`ws.Columns("A:F").Insert Shift:=xlToRight\` (또는 \`ws.Range(ws.Columns(1), ws.Columns(6)).Insert Shift:=xlToRight\`).
  - **바운드 범위 삽입(\`ws.Range(Cells(1,1),Cells(lastRow,6)).Insert\`)은 쓰지 마세요** — 행 전체를 가로지르는 병합 헤더(예: "■ 2026년 02월 ...")가 있으면 1004("병합된 셀의 일부를 변경할 수 없습니다")로 실패합니다. 전체 열 삽입은 열 전체를 통째로 밀어 병합이 깨지지 않습니다.
- **읽기/계산용 데이터는 실제 범위로 한정**하세요(\`lastRow = ws.Cells(ws.Rows.Count,1).End(xlUp).Row\`, \`ws.Range(ws.Cells(1,1), ws.Cells(lastRow,n)).Value\`). 전체 열을 배열로 읽지 마세요(느림).
- **"맨 앞에 N열 삽입 + 그 N열 복제" 정석(병합 안전):**
  \`\`\`vba
  ws.Columns("A:F").Insert Shift:=xlToRight   ' 전체 열 삽입 → 원본은 G:L 로 이동, 병합 유지
  ws.Columns("G:L").Copy                        ' 전체 열 복사(서식·병합 포함)
  ws.Columns("A:F").PasteSpecial xlPasteAll     ' 새로 생긴 맨 앞 6열에 붙여넣기
  Application.CutCopyMode = False
  \`\`\`
  (전체 열 ↔ 전체 열 복사/붙여넣기는 크기가 같아 병합이 보존됩니다. 단순 값 이동이면 \`.Value\` 배열 복사도 가능하나 서식·병합은 사라집니다.)
- 절대 \`Range("A:F").Copy Destination:=Range("A1")\` 처럼 같은 위치에 복사하지 마세요(변화 0).

## 금지
- MsgBox, InputBox 등 사용자 입력/대화상자를 띄우지 마세요(자동 실행이라 멈춥니다).
- 파일 열기/저장/종료(Workbooks.Open, .Save, .Close, Application.Quit) 금지. 다른 워크북을 건드리지 마세요.
- Shell, 파일시스템/네트워크용 CreateObject(FileSystemObject, WScript 등) 금지. (Scripting.Dictionary 같은 순수 메모리 객체는 허용.)
- "On Error Resume Next" 로 오류 무시 금지(위 '실패를 숨기지 말 것' 참고).

## 표준 구조 예시 (이 골격을 따르세요)
\`\`\`vba
Sub B2BSkill()
    ' 화면/계산을 잠시 끄되, 끝/오류 어디서든 반드시 원복해야 합니다.
    ' Err.Raise 가 원복 전에 호출되면 Calculation 이 Manual 로 고착되어
    ' 워크북 전체 재계산이 멈춥니다 → 반드시 아래처럼 On Error GoTo Cleanup 으로 감싸세요.
    Dim prevCalc As XlCalculation: prevCalc = Application.Calculation
    Dim raisedNum As Long, raisedSrc As String, raisedDesc As String
    On Error GoTo Cleanup
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    Dim ws As Worksheet
    ' 대상 시트: 요청에 시트/파일 이름이 있으면 그걸 명시적으로 잡으세요(ActiveSheet 로 두지 말 것).
    '   예) Set wb = (위 안전 탐색으로 찾은 워크북); Set ws = wb.Worksheets("매출")  ' 없으면 Err.Raise
    ' 이름 언급이 전혀 없을 때만 활성 시트를 기본 대상으로:
    Set ws = ActiveWorkbook.ActiveSheet

    Dim hdrRow As Long: hdrRow = 1         ' 스키마에서 실제 헤더 행 확인(예: 회사별요약은 3행)
    Dim lastRow As Long, lastCol As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    lastCol = ws.Cells(hdrRow, ws.Columns.Count).End(xlToLeft).Column
    If lastRow <= hdrRow Or lastCol < 1 Then Err.Raise vbObjectError + 513, "B2BSkill", "데이터가 없습니다."
    ' 합계/평균 같은 요약행(SUM/AVERAGE)이 표 끝에 있으면 그 행은 대상에서 제외하세요.
    ' (요약행까지 덮으면 SUM/AVERAGE 수식이 깨집니다. 회사명/키 열이 비어 있으면 데이터 끝입니다.)

    Dim targetRng As Range, arr As Variant
    Set targetRng = ws.Range(ws.Cells(hdrRow + 1, 2), ws.Cells(lastRow, 2)) ' 예: 요청받은 대상 열만(헤더 다음~데이터 끝)
    arr = targetRng.Value      ' 1-based 2D 배열

    Dim changed As Long: changed = 0
    Dim r As Long
    For r = 1 To UBound(arr, 1)
        ' ... 메모리에서 계산, 바꾼 셀은 changed = changed + 1 ...
    Next r

    targetRng.Value = arr      ' 대상 열만 기록. 표 전체를 다시 쓰면 수식이 값으로 풀립니다.

    If changed = 0 Then Err.Raise vbObjectError + 514, "B2BSkill", "변경된 셀이 없습니다(대상/조건 확인)."

Cleanup:
    ' 성공/실패 모두 이 경로를 지나며 상태를 원복합니다.
    If Err.Number <> 0 Then
        raisedNum = Err.Number: raisedSrc = Err.Source: raisedDesc = Err.Description
    End If
    Application.Calculation = prevCalc          ' 원래 계산 모드로 복원(보통 xlCalculationAutomatic)
    Application.ScreenUpdating = True
    Application.CutCopyMode = False
    If raisedNum <> 0 Then Err.Raise raisedNum, raisedSrc, raisedDesc   ' 실패는 숨기지 말고 다시 전파
End Sub
\`\`\`
- 위는 골격일 뿐, 실제 작업(복사/삽입/정렬/필터 등)은 요청에 맞게 작성하세요. 핵심은: 실제 범위로 한정 · 벌크 입출력 · 변경 0건이면 Err.Raise · **오류 어디서든 On Error GoTo Cleanup 으로 계산/화면 원복 후 재전파** · 합계/요약행은 대상에서 제외.
- \`On Error GoTo Cleanup\` 은 허용됩니다(오류를 숨기지 않고, 상태만 원복 후 Cleanup 에서 다시 Err.Raise 로 전파하므로). 금지된 것은 \`On Error Resume Next\`(오류를 삼켜 그냥 지나가는 것)입니다.
`;

// 스킬 실행 엔진(Python/openpyxl)이 선택됐을 때 프롬프트에 덧붙이는 안내.
// VBA 엔진이면 빈 문자열(VBA_SYSTEM_PROMPT가 별도로 사용됨).
function skillEnginePromptNote() {
  const engine = typeof getSkillEngine === "function" ? getSkillEngine() : "python";
  if (engine !== "python") return "";
  return `
## 실행 엔진: 순수 Python(openpyxl) — 현재 선택됨
- 기본 실행은 실제 Excel(COM)이 아니라 openpyxl 워크북 위에서 인프로세스로 실행됩니다(빠름).
- ctx 헬퍼 우선: ctx.sheet, ctx.input, ctx.rows, ctx.iter_rows, ctx.rows_with_index, ctx.display_rows, ctx.value, ctx.display_value, ctx.col, ctx.header_row, ctx.data_start_row, ctx.add_sheet, ctx.sort, ctx.filter_to_sheet, ctx.pivot, ctx.normalize, ctx.write_grid, ctx.set_range.
- openpyxl 워크시트 메서드도 사용 가능: \`ws.cell(row=r, column=c).value\`, \`ws.insert_cols(idx, amount)\`, \`ws.insert_rows(idx, amount)\`, \`ws.delete_cols(idx, amount)\`, \`ws.delete_rows(idx, amount)\`, \`ws.append([...])\`, \`ws.max_row\`, \`ws.max_column\`. 단, 출력 파일의 수식 셀에서 \`ws.cell(...).value\` 는 계산값이 아니라 수식 문자열입니다.
- COM 전용 호출은 기본적으로 사용하지 마세요: AutoFilter, Range.End, Range.Offset, Worksheet.Copy, Columns(i).Insert(), Rows(i).Insert(), ctx.excel.
- 입력 파일 읽기: 수식이 있어도 ctx.rows / ws.Range().Value 는 **계산된 값**을 돌려줍니다(파일에 저장된 계산 결과). 그대로 읽으면 됩니다.
- \`ctx.rows(ws)\` 의 각 row는 셀 객체가 아니라 값 리스트입니다. \`row[0].row\`, \`row[0].value\` 를 쓰지 마세요. 대상 행번호가 필요하면 \`for excel_row, row in ctx.iter_rows(ws, start_row=ctx.data_start_row(ws)):\` 를 쓰세요.
- 출력 파일 수식: 기존 수식은 **보존**되며, 빈칸을 채우면 그 수식들은 파일을 Excel에서 열 때 **자동 재계산**되어 새 값이 보입니다. 즉 수식 셀을 직접 덮어쓸 필요 없이 입력 셀(예: 빈칸)만 채우면 됩니다.
- **드래그한 열/범위 복붙**: 사용자가 선택 범위를 가리키며 "이거 복사해서 붙여넣어"라고 하면 선택된 데이터 범위의 헤더, 텍스트, 숫자, 수식, 빈칸을 같은 행/열 상대 위치로 모두 옮기세요. 숫자 셀만 골라내거나 빈칸을 제거해 압축하지 마세요. 사용자가 "숫자만/금액만"이라고 명시한 경우에만 숫자 필터를 사용하세요.
- **복붙의 기본값은 셀 복사**입니다. 사용자가 "값"을 말하지 않았으면 \`ctx.rows()\` 로 읽은 값 배열을 \`write_grid\` 로 쓰는 방식은 금지입니다. 그 방식은 서식/수식/병합/열너비가 빠집니다. 원본 셀을 \`ws.cell(row=r, column=c).value\` 로 읽어 같은 상대 위치의 대상 셀에 대입하거나, 서식 유지가 핵심이면 Excel COM fallback 주석을 넣어 Excel 복사로 실행하세요.
- **값만 복사 / 보이는 값 복사**: 원본이 출력 파일의 수식 셀이면 반드시 \`ctx.value(ws, row, col)\` 또는 \`ctx.display_rows(ws)\` 로 계산 결과 값을 읽으세요. \`ws.cell(...).value\` 를 그대로 쓰면 \`=B1+C1\` 같은 수식 문자열이 대상에 들어가 실패합니다.
- 단, **이번 단계에서 쓴 값으로 계산되는 수식의 결과를 같은 코드 안에서 다시 읽지는 마세요**(openpyxl 은 그 자리에서 계산하지 않습니다). 결과 값이 필요하면 Python 에서 직접 계산하세요.
- 입력 파일도 기본 openpyxl 경로에서 수정할 수 있고, 스킬 실행 후 변경된 입력 결과가 다운로드됩니다. 사용자가 입력 파일에 새 시트/중간 시트/정렬 결과를 만들라고 하면 해당 입력 workbook에 작성하세요. 단, 병합/서식 유지 복붙/Excel 고유 동작이 꼭 필요할 때만 \`# B2B_ENGINE_FALLBACK: excel-com\` 마커로 Excel COM Python fallback을 요청하세요.
- 병합셀 단순 값 변경/텍스트 치환은 가능합니다. 병합영역 내부 셀에 쓰는 경우 좌상단 셀만 실제로 쓰인다고 보고, 같은 병합영역을 여러 번 덮어쓰지 마세요.
- 병합셀을 포함한 파일에서 **열/행 삽입·삭제, 서식 유지 복사/붙여넣기, 병합 구조 변경**이 필요하면 Excel 방식 처리가 안전합니다. 이때도 VBA가 아니라 Python 코드를 작성하되 코드 첫 줄 근처에 \`# B2B_ENGINE_FALLBACK: excel-com\` 주석을 넣고, Excel COM 호환 API(\`ws.Columns("J").Insert\`, \`src.Copy(dest)\`, \`PasteSpecial\`)를 사용하세요. 서버가 이 Python step을 Excel COM Python으로 자동 실행합니다.
- Excel COM Python fallback에서도 \`win32com\`을 import하지 마세요. 스킬 샌드박스에서 import가 차단됩니다. 이미 제공된 ctx.sheet(...), ctx.input(...), ws.Range/Cells/Columns/Rows 같은 COM 호환 객체만 사용하세요.
- **COM 폴백 성능 규칙(매우 중요 — COM 은 셀 단위 호출이 왕복당 느림)**:
  - 읽기는 한 번에: \`rows = ctx.rows(ws)\` 또는 \`grid = ws.Range(...).Value\` 로 2차원으로 받아 Python 메모리에서 계산하세요. 루프 안에서 \`ws.Cells(r,c).Value\` 를 반복 읽지 마세요.
  - 쓰기도 한 번에: 결과를 2차원 리스트로 모아 \`ws.Range(ws.Cells(r1,c1), ws.Cells(r2,c2)).Value = grid\` 한 번으로. **루프 안에서 셀 단위 .Value= 반복 금지.**
  - **전체 열/행 연산 금지**: \`ws.Range("A:F")\`, \`ws.Columns(...)\` 는 104만 행 전체를 처리해 수십 초가 걸립니다. 실제 데이터 범위(\`ws.Cells(r,c)\` 기반)로 반드시 한정하세요.
  - 열/행 삽입은 한 번의 호출로: \`ws.Range(ws.Cells(1,1), ws.Cells(1,N)).EntireColumn.Insert()\`. 삽입만으로 기존 데이터가 밀려나므로 별도 전체 열 Copy 가 필요 없습니다.
  - \`.Select()/.Activate()\`, \`ActiveWorkbook/ActiveSheet\` 의존, \`.Save/.Close/.Quit\` 호출 금지(앱이 라이브 세션을 관리).
- 병합셀이 없거나 단순 표 작업이면 열/행 삽입·삭제는 openpyxl의 \`ws.insert_cols/insert_rows/delete_cols/delete_rows\` 를 사용하세요.
`;
}

// 스키마가 모델 컨텍스트를 잡아먹어 max length(예: 20만)를 넘기지 않도록 하는 예산/상한.
const SCHEMA_TOKEN_BUDGET = 60000;        // 파일 스키마가 차지할 최대 추정 토큰
const SCHEMA_CHARS_PER_TOKEN = 2;         // 한/영/JSON 혼합 보수적 추정(토큰을 과대평가 → 안전)
const EDIT_CONTEXT_TOKEN_BUDGET = 70000;  // 수정 모드 컨텍스트(코드 포함) 상한

function _estimateSchemaTokens(text) {
  return Math.ceil(String(text || "").length / SCHEMA_CHARS_PER_TOKEN);
}

function _truncSchemaCell(value, maxLen) {
  let s = JSON.stringify(value);
  if (s === undefined) s = "\"\"";
  if (maxLen && s.length > maxLen) s = s.slice(0, Math.max(1, maxLen - 1)) + "…";
  return s;
}

// 강한 순서대로: 토큰 예산을 넘으면 다음 단계로 더 줄여 다시 빌드한다.
const SCHEMA_LEVELS = [
  { inputRows: 5, outputRows: 30, maxCols: 40, maxCellLen: 80, maxSheets: 20 },
  { inputRows: 4, outputRows: 15, maxCols: 25, maxCellLen: 48, maxSheets: 12 },
  { inputRows: 3, outputRows: 8,  maxCols: 16, maxCellLen: 32, maxSheets: 8 },
  { inputRows: 2, outputRows: 4,  maxCols: 10, maxCellLen: 24, maxSheets: 5 },
  { inputRows: 1, outputRows: 2,  maxCols: 6,  maxCellLen: 16, maxSheets: 3 },
];

function _sheetTotalRowsForSchema(file, sheetName, aoa) {
  const dim = file && file.backendPreviewDimensions && file.backendPreviewDimensions[sheetName];
  return Math.max(Number(dim && dim.maxRow) || 0, (aoa || []).length || 0);
}

// 1-based 열 번호 → 엑셀 열 문자(A, B, ..., AA ...). 스키마의 열문자↔헤더 매핑 출력용.
function _colLetter(n) {
  let s = "";
  n = parseInt(n, 10) || 0;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s || "A";
}

function _describeFile(f, opts, lines) {
  const headPreview = opts.headPreview || 5;
  const maxCols = opts.maxCols || 40;
  const maxCellLen = opts.maxCellLen || 80;
  const maxSheets = opts.maxSheets || 20;
  lines.push(`\n### ${f.name}`);
  const sheetNames = f.sheetNames || [];
  const shownSheets = sheetNames.slice(0, maxSheets);
  shownSheets.forEach(sn => {
    const aoa = f.sheets[sn] || [];
    const totalRows = _sheetTotalRowsForSchema(f, sn, aoa);
    const previewNote = totalRows > aoa.length ? ` (현재 미리보기 ${aoa.length}행)` : "";
    lines.push(`시트 "${sn}": 전체 ${totalRows}행${previewNote}`);

    const tables = (f.tables || {})[sn] || [];
    if (tables.length > 1) {
      lines.push(`  감지된 표 후보 ${tables.length}개`);
      tables.slice(0, 5).forEach((t, i) => {
        lines.push(`     ${i + 1}) "${t.label}" 범위 ${t.range}, 헤더 행 ${t.headerRow + 1}`);
      });
    }

    const formulas = (f.formulas || {})[sn] || {};
    const fkeys = Object.keys(formulas);
    if (fkeys.length > 0) {
      lines.push(`  수식 셀 ${fkeys.length}개 (예: ${fkeys.slice(0, 3).map(k => k + "=" + formulas[k]).join(", ")})`);
    }

    // 열문자 ↔ 헤더명 매핑: 사용자가 "T열" 같은 열 문자로 지정해도 정확한 열을 잡도록.
    const hdrRowIdx = (tables[0] && typeof tables[0].headerRow === "number") ? tables[0].headerRow : 0;
    const hdrRow = aoa[hdrRowIdx] || aoa[0] || [];
    if (hdrRow.length) {
      const colMap = [];
      hdrRow.slice(0, maxCols).forEach((v, ci) => {
        const name = _truncSchemaCell(v, 24);
        if (name !== "") colMap.push(`${_colLetter(ci + 1)}=${name}`);
      });
      if (colMap.length) lines.push(`  열(${hdrRowIdx + 1}행 헤더): ${colMap.join(" | ")}`);
    }

    const preview = aoa.slice(0, headPreview);
    preview.forEach((row, i) => {
      const full = row || [];
      const cells = full.slice(0, maxCols).map(v => _truncSchemaCell(v, maxCellLen));
      const omittedCols = full.length > maxCols ? ` …(${full.length - maxCols}열 생략)` : "";
      lines.push(`  행 ${i + 1}: [${cells.join(", ")}]${omittedCols}`);
    });
    if (totalRows > headPreview) lines.push(`  ... (${totalRows - headPreview}행 생략)`);
  });
  if (sheetNames.length > shownSheets.length) {
    const rest = sheetNames.slice(shownSheets.length).join(", ");
    lines.push(`  ... (시트 ${sheetNames.length - shownSheets.length}개 더: ${rest.length > 200 ? rest.slice(0, 200) + "…" : rest})`);
  }
}

function buildSchemaSummary() {
  let out = "";
  for (let i = 0; i < SCHEMA_LEVELS.length; i++) {
    out = _buildSchemaSummaryAtLevel(SCHEMA_LEVELS[i]);
    if (_estimateSchemaTokens(out) <= SCHEMA_TOKEN_BUDGET) {
      if (i > 0) out += `\n\n(참고: 파일이 커서 스키마 미리보기를 ${i + 1}단계로 축소했습니다. 필요한 행/열은 코드로 직접 읽으세요.)`;
      return out;
    }
  }
  // 가장 축소한 단계도 예산을 넘으면 문자 단위로 하드 컷.
  const maxChars = SCHEMA_TOKEN_BUDGET * SCHEMA_CHARS_PER_TOKEN;
  if (out.length > maxChars) {
    out = out.slice(0, maxChars) + "\n... (스키마가 토큰 한도를 넘어 일부 생략됨)";
  }
  return out;
}

function _buildSchemaSummaryAtLevel(lvl) {
  const inputOpts = { headPreview: lvl.inputRows, maxCols: lvl.maxCols, maxCellLen: lvl.maxCellLen, maxSheets: lvl.maxSheets };
  const outputOpts = { headPreview: lvl.outputRows, maxCols: lvl.maxCols, maxCellLen: lvl.maxCellLen, maxSheets: lvl.maxSheets };
  const lines = [];
  lines.push("## 입력 파일 목록 (수정 가능)");
  state.inputs.forEach(f => _describeFile(f, inputOpts, lines));

  const targetHint = _buildDefaultTargetHint();
  if (targetHint) {
    const multi = (state.selectedSheets || []).length > 1;
    const header = multi
      ? "\n## 사용자가 직접 선택한 작업 대상 (이 대상을 우선 사용하고 추가 질문 금지)"
      : "\n## 사용자가 현재 보고 있는 대상 (명령에 파일/시트가 없을 때 기본 대상)";
    lines.push(header);
    lines.push(targetHint);
  }

  if (state.pipeline.length > 0) {
    lines.push(`\n## 이미 적용된 파이프라인 단계 (${state.pipeline.length}개, 반복 금지)`);
    state.pipeline.forEach((s, i) => lines.push(`  Step ${i + 1}. ${s.description}`));
    lines.push("\n현재 입력/출력은 위 단계들이 이미 적용된 상태입니다. 새 요청에서 말한 작업만 수행하세요.");
  }

  if (state.outputTemplates && state.outputTemplates.length) {
    lines.push("\n## 현재 출력 템플릿 목록");
    state.outputTemplates.forEach((tpl, idx) => {
      lines.push(`\n#### 출력 템플릿 ${idx + 1}: ${tpl.file.name}`);
      _describeFile(tpl.file, outputOpts, lines);
    });
  } else if (state.output) {
    const label = state.pipeline.length > 0
      ? "## 현재 출력 상태 (이전 단계들이 적용된 결과, 수정 가능)"
      : `## 출력 템플릿 (원본, 수정 가능): ${state.output.name}`;
    lines.push("\n" + label);
    _describeFile(state.output, outputOpts, lines);
  }

  if (state.selectedCell && state.selectedCell.fileId === state.currentFileId && state.selectedCell.sheet) {
    lines.push(`선택 셀: "${state.selectedCell.sheet}!${_excelCol(state.selectedCell.c)}${state.selectedCell.r + 1}"`);
    lines.push("사용자가 결과 위치를 직접 클릭한 경우 '여기', '선택한 셀', '이 셀'은 이 선택 위치를 의미합니다.");
  }
  return lines.join("\n");
}

function _buildDefaultTargetHint() {
  if (!state.currentFileId) return "";
  const file = (typeof getFile === "function") ? getFile(state.currentFileId) : null;
  if (!file) return "";
  const sheets = (state.selectedSheets && state.selectedSheets.length)
    ? state.selectedSheets
    : (state.currentSheet ? [state.currentSheet] : []);
  const tag = (typeof isOutputFileId === "function" && isOutputFileId(state.currentFileId)) ? "[출력]" : "[입력]";
  const isOutputTarget = tag === "[출력]";
  const multi = sheets.length > 1;
  const lines = [];
  lines.push(`${tag} 파일: "${file.name}"`);
  lines.push(`기본 대상 객체: ${isOutputTarget ? "ctx.workbook / ctx.sheet(...)" : `ctx.input(${JSON.stringify(file.name)})`}`);
  if (isOutputTarget) {
    lines.push("사용자가 파일/시트를 명시하지 않으면 현재 출력 파일/시트를 수정하세요.");
  } else {
    lines.push("사용자가 파일/시트를 명시하지 않으면 현재 입력 파일/시트를 작업 기준으로 사용하세요.");
    lines.push("현재 입력 파일 자체에 새 시트 생성/삽입/삭제/서식 복사처럼 저장이 필요한 변경을 해야 하면 Python 코드 첫 줄 근처에 # B2B_ENGINE_FALLBACK: excel-com 을 넣으세요.");
  }
  if (multi) {
    lines.push(`사용자가 직접 선택한 시트 ${sheets.length}개:`);
    sheets.forEach(s => lines.push(`  - "${s}"`));
    lines.push("사용자의 의도가 분명합니다. 위 시트들에만 작업하세요.");
    lines.push("다른 파일에 같은 컬럼명이 있어도 추가 질문 없이 선택된 시트를 우선하세요.");
  } else if (sheets.length === 1) {
    lines.push(`현재 활성 시트: "${sheets[0]}"`);
    lines.push("사용자가 파일/시트를 명시하지 않으면 이 시트를 기본 대상으로 사용하세요.");
  }
  return lines.join("\n");
}

const PYTHON_COM_SYSTEM_PROMPT = `당신은 우측에 실제로 떠 있는 Microsoft Excel 워크북을 Python 으로 조작하는 코드 작성 도우미입니다.
작성한 코드는 즉시 라이브 Excel 에 실행되어 결과가 바로 화면에 보입니다. 파일을 열고 닫는 코드가 아닙니다.

## 실행 모델 — 매우 중요
- 코드는 \`def transform(ctx):\` 함수 하나로 작성합니다. ctx 가 유일한 Excel 접근 수단입니다.
- import 금지(이미 주어진 모듈: re, datetime, math). open/eval/exec/win32com/openpyxl 사용 불가.
- openpyxl 이 아닙니다 — \`ws["A1"]\`, \`ws.cell(row=,column=)\`, \`load_workbook\` 같은 openpyxl 문법은 동작하지 않습니다.
- 실패하면 조용히 넘어가지 말고 \`raise ValueError("사유")\` 로 알리세요(대상 시트/헤더가 없을 때 등).
- 아무 변경도 만들지 않으면 실행기가 실패로 처리합니다 — 요청한 변경을 반드시 수행하거나 raise 하세요.

## 성능 — COM 벌크 입출력 (가장 중요한 규칙)
- 모든 COM 호출에는 예산(400회)이 있고 초과 시 실행이 차단됩니다.
- **읽기는 ctx.read() 한 번, 계산은 Python 메모리(리스트)에서, 쓰기는 ctx.write() 한 번** — 이 3단 구조가 기본입니다.
- **루프 안에서 ctx.write()/ctx.write_cell()/ctx.copy() 를 반복 호출하면 정적 검사에서 차단됩니다.**
  바꿀 값들을 2차원 리스트로 모두 만든 뒤 마지막에 한 번만 쓰세요.
- 전체 열(A:F)을 통째로 읽지 마세요. \`ctx.last_row()\`/\`ctx.last_col()\` 로 실제 데이터 범위를 구해 한정하세요.
- 표 전체를 다시 쓰지 마세요(수식이 값으로 덮입니다). 요청받은 대상 열/범위만 쓰세요.

## ctx API (이것만 사용 — 시그니처 정확히)
- \`ctx.sheets()\` → 시트 이름 리스트
- \`ctx.last_row(시트, col=1)\` / \`ctx.last_col(시트, row=1)\` → 마지막 데이터 행/열(1-based)
- \`ctx.find_header(시트, "헤더명", header_row=1)\` → 열 번호(1-based). **열 번호를 추측/하드코딩하지 말고 반드시 이 함수로 찾으세요.**
- \`ctx.read(시트, "B2:D100")\` → 2차원 리스트(값). 범위 생략 시 전체 사용범위. **반환 리스트는 0-based** — values[0][0] 이 범위의 좌상단 셀.
- \`ctx.read_formulas(시트, 범위)\` → 수식 문자열 2차원 리스트(수식 없으면 값)
- \`ctx.has_formulas(시트, 범위)\` → 수식 존재 여부
- \`ctx.write(시트, "B2", 이차원리스트, overwrite_formulas=False)\` → 시작 셀 기준 한 번에 기록
- \`ctx.write_cell(시트, "B2", 값)\` → 단일 셀(소량 전용 — 루프 반복 금지)
- \`ctx.write_formulas(시트, "D2", [["=B2-C2"],["=B3-C3"]])\` → 수식 기록
- \`ctx.copy(원본시트, "A1:F20", 대상시트, "A1")\` → Excel 네이티브 복사(값+수식+서식+병합 보존). "복사/복붙" 요청의 기본 수단.
  - 복사/붙여넣기는 지정(선택) 범위를 **헤더·빈칸 포함 위치 그대로** 한 번의 \`ctx.copy\` 로 옮기세요. 값이 있는 셀만 골라 read→write 로 재구성하는 것은 금지입니다(서식·수식·빈칸 소실).
  - "맨 앞에/사이에 붙여넣기"는 먼저 \`ctx.insert_cols\`/\`ctx.insert_rows\` 로 자리를 만든 뒤 \`ctx.copy\` 하세요.
- \`ctx.clear(시트, 범위)\` → 내용 삭제(서식 유지)
- \`ctx.insert_rows(시트, 행번호, count=1)\` / \`ctx.delete_rows(...)\`
- \`ctx.insert_cols(시트, "B", count=1)\` / \`ctx.delete_cols(...)\` → 전체 열 단위(병합셀 안전)
- \`ctx.add_sheet("이름", after="기준시트")\` / \`ctx.delete_sheet("이름")\`
- \`ctx.sort(시트, "A1:F100", key_col="C", ascending=True, has_header=True)\` → 실제 범위 정렬.
  **key_col 은 "C" 같은 시트 기준 열 문자를 쓰세요.** 숫자로 주면 범위 내 상대 번호로 해석되므로(범위가 A열에서 시작하지 않으면 어긋남) 문자가 안전합니다.
- \`ctx.hide_cols(시트, "B:D", hidden=True)\` / \`ctx.hide_rows(시트, "5:8")\`
- \`ctx.merge(시트, "A1:E1")\` / \`ctx.unmerge(...)\` / \`ctx.set_number_format(시트, 범위, "#,##0")\`
- \`ctx.book("다른파일명.xlsx")\` → 같이 업로드된 다른 파일을 다루는 ctx (교차 파일 작업)

## 작업 대상 결정
- 기본 ctx 는 **현재 활성 파일**에 고정되어 있습니다(ActiveWorkbook 추측 불필요).
- 사용자가 다른 파일을 지목하면(@파일, "원가 파일에서") \`ctx.book("정확한 파일명.xlsx")\` 으로 그 파일을 잡으세요.
- 사용자가 시트 이름을 말했으면 그 이름을 그대로 쓰세요(없으면 ctx 가 자동으로 raise). "현재 선택 범위"가 주어지면 그 주소를 대상 범위로 사용하세요.
- **"새 시트에 정리/추출해줘"**: 사용자가 출력 파일을 지목하지 않았다면 새 시트는 **지금 작업 중인 그 파일(기본 ctx)** 안에 \`ctx.add_sheet\` 로 만들고 결과도 거기에 쓰세요. "새 시트"라는 말만으로 출력 템플릿 파일(\`ctx.book\`)로 옮기면 안 됩니다.

## 값 매칭 — 표기 변형 vs 다른 값
- 셀 값 비교는 **표기 변형은 같게, 다른 토큰은 다르게**: 공백/0 패딩/전각 차이("2월"="02 월"="2 월")는 같은 값으로 정규화해 비교하되, 글자가 덧붙은 값("안전제일_임시", "안전제일(예비)")은 **다른 값**입니다. 부분 문자열 포함(in) 매칭을 기본으로 쓰지 마세요.
- 요청만으로 정확 일치/포함 중 어느 쪽인지 판단할 수 없고 결과가 크게 달라진다면(예: 후보 값들이 접미사만 다른 경우), **코드를 쓰지 말고 한 가지만 되물어보세요**. (모호하지 않으면 묻지 말고 바로 작성)

## 헤더/데이터 위치
- 헤더가 항상 1행이라고 가정하지 마세요. 아래 "현재 파일 스키마"에서 실제 헤더 행을 확인하고 \`ctx.find_header(시트, "매출", header_row=실제행)\` 으로 열을 찾으세요.
- **표 끝의 합계/평균/소계 행은 데이터가 아닙니다.** last_row 가 그 행을 포함하면 -1 해서 제외하고, 값 채우기/정렬/삭제 대상에 절대 포함하지 마세요(수식이 깨집니다).

## 수식 보호
- "채워/입력/업데이트/반영"은 수식 제거 지시가 아닙니다. 수식이 있는 셀/열은 건너뛰세요.
- ctx.write 는 대상에 수식이 있으면 기본적으로 차단됩니다. \`overwrite_formulas=True\` 는 사용자가 "수식을 값으로 바꿔/제거해" 라고 **명시**했을 때만, 그 범위에 한정해서 쓰세요.

## 텍스트/날짜
- 한글 텍스트 비교는 스키마에 보이는 실제 셀 텍스트 그대로. 월 표기는 "02월"과 "2월"을 각각 처리.
- 날짜 셀은 Excel 시리얼 숫자(float)로 읽힐 수 있습니다. 필요하면
  \`datetime.datetime(1899,12,30) + datetime.timedelta(days=serial)\` 로 변환하세요.

## 멀티턴 맥락
- 이전 대화가 있어도 **이번 턴 요청 하나만** 수행하세요. (a) 무관한 새 작업이면 이전 대상을 다시 건드리지 않기 (b) 직전 작업이 실패했어도 이번 요청이 다른 작업이면 재시도하지 않기 (c) "방금 그거 ~하게 다시"는 같은 대상을 이어서 개선.

## 표준 골격 (이 구조를 따르세요)
\`\`\`python
def transform(ctx):
    sheet = "매출"                       # 요청/스키마에서 확인한 실제 시트명
    hdr_row = 1                          # 스키마에서 실제 헤더 행 확인
    last = ctx.last_row(sheet, col=1)
    if last <= hdr_row:
        raise ValueError("데이터가 없습니다.")
    # 합계행이 있으면 제외: 키 열 마지막 셀이 '합계' 류면 last -= 1

    amt_col = ctx.find_header(sheet, "매출", header_row=hdr_row)   # 열은 헤더로 찾기
    # 열 번호 → 열 문자(27열 이상 AA, AB... 도 안전):
    def col_letter_of(n):
        s = ""
        while n:
            n, r = divmod(n - 1, 26)
            s = chr(65 + r) + s
        return s
    col_letter = col_letter_of(amt_col)

    rows = ctx.read(sheet, f"{col_letter}{hdr_row+1}:{col_letter}{last}")  # 읽기 1회
    out = []
    changed = 0
    for r in rows:                        # 계산은 메모리에서 (ctx 호출 없음)
        v = r[0] if r and r[0] is not None else 0
        out.append([v * 1.1])
        changed += 1
    if changed == 0:
        raise ValueError("변경 대상이 없습니다(조건 확인).")

    ctx.write(sheet, f"{col_letter}{hdr_row+1}", out)              # 쓰기 1회
\`\`\`
- 핵심: 실범위 한정 · read 1회 → 메모리 계산 → write 1회 · 수식/합계행 보호 · 실패는 raise.
- 위 골격은 표 데이터를 다룰 때의 모범일 뿐 강제 양식이 아닙니다. **단순 작업(셀 몇 개 쓰기,
  시트 추가, 범위 복사 등)은 골격 없이 2~6줄로 끝내세요.** 예: \`def transform(ctx): ctx.write_cell("매출", "B2", 100)\`

## 간결성 — 짧고 한 번만
- 코드는 요청을 만족하는 **최소 길이**로. 보통 10~40줄, 단순 작업은 10줄 미만이 정상입니다.
- **같은 줄/같은 블록을 반복해서 출력하지 마세요.** 비슷한 처리가 여러 열/시트에 반복되면 복붙이 아니라 for 루프와 리스트로 묶으세요(단, ctx 쓰기는 루프 밖에서 한 번).
- 요청하지 않은 방어 코드(불필요한 try/except, 모든 시트 검사, 임시 변수 나열)를 덧붙이지 마세요. 실패 처리는 raise 한 줄이면 충분합니다.
- 코드 블록은 **하나만**, 설명은 1~2문장만. 같은 코드를 다시 출력하거나 수정본을 연달아 붙이지 마세요.

## 출력 형식
- 코드 앞에 작업 요약 1~2문장. 그 다음 **단 하나의 \`\`\`python 코드 블록**으로 \`def transform(ctx):\` 전체를 출력하세요.
- **설명·계획·주석만으로 응답을 끝내지 마세요.** 어떤 요청이든 실행 가능한 코드 블록이 반드시 포함되어야 합니다(모호하면 합리적 기본값을 택해 코드로 작성). 파일/시트가 정말 특정 불가능할 때만 코드 없이 한 가지 질문을 하세요.
`;
// [0.5.4 하이브리드] 기본 엔진은 위 Python COM(라이브 워크북 직접 제어)이다.
// openpyxl 이 꼭 필요한 경우(Excel 미설치 환경 대비 배치 변환 등)는 서버가 자동 폴백하며,
// 그때는 기존 openpyxl SYSTEM_PROMPT 규칙의 코드가 실행된다.
// 라우팅 규칙: 스텝 코드 첫 줄 부근의 `# B2B_ENGINE: openpyxl` 마커가 있으면 라이브 COM 대신
// 백엔드 openpyxl 파이프라인으로 보낸다(pipelineStepLiveLanguage). 생성은 항상 COM 규약.

const SYSTEM_PROMPT = `${PYTHON_EXCEL_SKILL_RULE}
${FORMULA_OVERWRITE_RULE}

당신은 업로드된 Excel 파일을 실제 Microsoft Excel COM으로 자동화하는 코드 작성 도우미입니다.

## 실행 구조
사용자는 여러 개의 단계(step)를 순서대로 쌓아 하나의 파이프라인을 만듭니다.
각 단계는 이전 단계가 이미 모두 적용된 workbook 상태에서 시작합니다.
지금 작성하는 코드는 이번 요청 하나만 처리해야 하며, 이전 단계의 작업을 반복하거나 합쳐 넣으면 안 됩니다.

예를 들어 사용자가 이전에 "고객정보 수정"을 요청했고 이번에는 "월별 테이블 만들기"를 요청했다면,
이번 코드는 월별 테이블을 만드는 작업만 작성하세요.

## 함수 시그니처
def transform(ctx):
    # ctx.input("파일 힌트").sheet("시트명") 로 입력 시트를 읽습니다.
    # ctx.sheet("시트명") 로 출력 시트를 수정합니다.
    # 명시 범위는 ws.Range("B61").Value 처럼 Excel 주소를 그대로 사용합니다.
    return None

## 코드 작성 원칙
- 요청받은 작업만 수행하세요. 사용자 요청에 없는 기능이나 이전 단계의 작업을 추가하지 마세요.
- 가능한 가장 단순한 코드로 작성하세요.
- 파일명에 날짜/월/버전이 있으면 전체 파일명을 하드코딩하기보다 ctx.input("매출"), ctx.input("원가") 같은 힌트 기반 접근을 우선하세요.
- 전체 시트를 순회해야 할 때만 순회하고, 먼저 대상 시트/헤더/범위를 좁히세요.
- 데이터 행 루프는 ctx.data_start_row(ws)를 기준으로 시작하세요.
- 파일/시트/범위가 명확하지 않으면 현재 선택된 파일/시트/범위를 기본값으로 사용하세요.
- 기본값으로도 해결되지 않는 모호함만 사용자에게 질문하세요.
- 작업 성공 기준을 구체적으로 정하고, 코드는 그 기준만 만족하게 작성하세요.

## 월별 데이터 처리
- "월별 매출", "월별 실적", "월별 데이터" 요청은 먼저 월별집계, 월별실적, 월별 같은 시트나 열을 찾으세요.
- 단순히 파일명이 4월이라는 이유만으로 전체 데이터를 4월로 단정하지 마세요.
- 출력 요청이 "월, 총매출, 거래건수 순서"처럼 열 순서를 지정하면 출력 시트 헤더도 그 순서에 맞추세요.
- 월 비교는 공백/0패딩 차이를 감안하세요. 예: "1월", "01월", "1 월".

## 정렬 / 필터 / 피벗 (자주 쓰는 작업 — 헬퍼 우선 사용)
- 가능하면 아래 ctx 헬퍼를 쓰세요. 직접 COM을 쓰는 것보다 안정적입니다.
- **정렬**: \`ctx.sort(ws, "컬럼명", ascending=True, header=True)\`. **여러 기준으로 정렬하려면 컬럼 리스트로 한 번에** 쓰세요: \`ctx.sort(ws, ["EID", "수납금액", "가입자당단가_도매대가"])\` (방향 혼합 시 \`ascending=[True, False, True]\`). ⚠️ 같은 시트에 \`ctx.sort\` 를 여러 번 연달아 호출하지 마세요 — 뒤 정렬이 앞 정렬을 무효화하고 대용량에서 느립니다. 다중 기준은 반드시 한 번의 리스트 호출로.
- **필터**: \`ctx.filter_to_sheet(ws, lambda row: 조건, "결과시트명")\` — 헤더+조건에 맞는 행을 새 시트로 복사. 원본은 유지.
  - 예: \`ctx.filter_to_sheet(ws, lambda r: ctx.normalize(r[ctx.col(ws,"상태")-1]) == ctx.normalize("완료"), "완료건")\`
- **피벗(그룹 요약)**: \`ctx.pivot(ws, group_by="회사명", value="매출", agg="sum", dest_name="회사별요약")\`
  - group_by는 문자열 또는 리스트, agg는 "sum"/"count"/"avg"/"max"/"min". 새 시트에 요약 표를 만듭니다.
  - 공식 인자명은 \`group_by\`, \`value\`, \`agg\`, \`dest_name\` 입니다. pandas식 \`rows=\`, \`values=\` 로 작성하지 말고 위 형식을 우선 사용하세요.
  - 같은 group_by에 대해 건수+금액합계+다른금액합계처럼 여러 집계가 필요하면 한 번에 만드세요: \`ctx.pivot(ws, group_by="MVNO상품명", value=["MVNO상품명","수납금액","가입자당단가_도매대가"], agg=["count","sum","sum"], dest_name="MVNO상품명별_피벗")\`. 따로 만든 여러 피벗 시트의 컬럼이 한 시트에 있다고 가정하지 마세요.
- **COM 상수 주의**: 샌드박스에서 \`win32com\` 및 그 상수(xlAscending, xlYes 등)는 import할 수 없습니다.
  직접 Range.Sort/PivotTable 등을 호출해야 하면 이름 상수 대신 **숫자 값**을 쓰세요(예: 오름차순 1, 내림차순 2, 헤더있음 1).
- AutoFilter를 최종 결과로 의존하지 마세요(읽기전용 미러에서 on/off 상태가 불안정). 필요하면 ctx.filter_to_sheet로 새 시트를 만드세요.
- **중간/결과 시트 위치 (다단계 작업에서 매우 중요)**: 새 시트의 기본 위치는 **현재 활성 파일/시트 또는 원본으로 넘긴 시트의 워크북**입니다. \`ctx.sheet()\` 는 사용자가 보고 있던 활성 파일/시트를 기본으로 잡습니다. \`ctx.filter_to_sheet(ws, ...)\`·\`ctx.pivot(ws, ...)\` 는 \`ws\` 가 속한 워크북에 새 시트를 만듭니다. 출력에 만들려면 \`workbook=ctx.workbook\`, 특정 입력에 만들려면 \`workbook=ctx.input("파일힌트")\` 를 명시하세요.
- 입력 파일 자체에 새 시트 생성, 필터 결과 시트 작성, 중간 시트 덮어쓰기처럼 값 중심의 변경을 해야 하면 기본 openpyxl로 처리하세요. 서식 유지 복붙, 병합 구조 변경, Excel 고유 삽입/삭제 보정처럼 openpyxl로 위험한 경우에만 \`# B2B_ENGINE_FALLBACK: excel-com\` 마커를 넣어 Excel COM Python으로 실행하세요.
- **다단계 시트명 연속성**: 한 중간 시트를 여러 단계로 이어 가공할 땐, 다음 단계가 **직전 단계가 만든 바로 그 시트명**을 읽어야 합니다. 예: 1단계가 \`안전제일_정렬\`을 만들고 2단계가 거기서 중복제거한다면, 결과를 같은 \`안전제일_정렬\` 에 덮어쓰거나(권장) 새 이름으로 만들었으면 3단계가 그 **새 이름**을 읽으세요. 가공 결과를 새 시트에 두고 이후 단계가 가공 전 원래 시트를 읽으면 갱신 전 값이 집계됩니다(흔한 실수).

## import 규칙
- 표준 라이브러리 import는 허용됩니다(예: re, json, datetime, math, collections, itertools, functools, decimal, statistics, random, difflib 등).
- os, sys, subprocess, shutil, pathlib 등 시스템/파일 접근 모듈은 import할 수 없습니다.

## 수식 보존 규칙
- 다운로드 시 값을 바꾸지 않은 셀은 원본 xlsx의 수식과 서식을 유지합니다.
- 값을 쓰지 않는 셀을 불필요하게 다시 대입하지 마세요.
- 특정 셀에 값을 덮어쓰라고 한 경우에만 해당 Range.Value를 직접 대입하세요. 이때 Excel에서 기존 수식은 값으로 대체됩니다.
- 열/행 추가, 복사, 삭제는 현재 실행 엔진 안내를 따르세요. 기본 Python(openpyxl)에서는 ws.insert_cols/insert_rows/delete_cols/delete_rows 를 쓰고, 서식 유지 복사나 병합셀 구조 변경처럼 Excel 방식 보정이 필요할 때만 \`# B2B_ENGINE_FALLBACK: excel-com\` 마커와 COM 호환 API를 사용하세요.

## 응답 형식
1. 코드 블록 앞에 반드시 "제목: 작업 내용 요약" 한 줄을 쓰세요.
2. 응답은 정확히 하나의 \`\`\`python 코드 블록을 포함해야 합니다.
3. 코드 블록 밖 설명은 1~2문장으로 짧게 쓰세요.
4. 외부 라이브러리는 사용하지 마세요. Python 표준 라이브러리와 제공된 ctx/workbook 객체만 사용하세요.
`;

const EDIT_SYSTEM_PROMPT = `${PYTHON_EXCEL_SKILL_RULE}
${FORMULA_OVERWRITE_RULE}

당신은 이미 만들어진 Excel 자동화 파이프라인의 특정 단계(step)를 수정하는 도우미입니다.

## 수정 모드 규칙
- 새 단계를 추가하는 것이 아닙니다.
- 아래 제공되는 현재 코드를 하나의 완성된 교체 코드로 다시 작성하세요.
- 이전/이후 단계는 그대로 유지됩니다.
- 수정 요청과 직접 관련된 부분만 바꾸고, 기존 동작을 임의로 리팩터링하지 마세요.
- 현재 코드가 하던 핵심 작업은 유지하되, 사용자의 수정 의도를 반영하세요.

## 함수 시그니처
def transform(ctx):
    ...

## 응답 형식
1. 코드 블록 앞에 반드시 "제목: 수정 내용 요약" 한 줄을 쓰세요.
2. 응답은 정확히 하나의 \`\`\`python 코드 블록을 포함해야 합니다.
3. 코드 블록 밖 설명은 1~2문장으로 짧게 쓰세요.
4. 외부 라이브러리는 사용하지 마세요. Python 표준 라이브러리와 Excel COM 객체만 사용하세요.
`;

function previewSheets(sheets, headRows) {
  const EDIT_MAX_COLS = 24;
  const EDIT_MAX_CELL_LEN = 48;
  const EDIT_MAX_SHEETS = 12;
  const lines = [];
  const sheetNames = Object.keys(sheets || {});
  sheetNames.slice(0, EDIT_MAX_SHEETS).forEach(sn => {
    const aoa = sheets[sn] || [];
    lines.push(`sheet "${sn}": ${aoa.length} rows`);
    const limit = headRows || 5;
    const preview = aoa.slice(0, limit);
    preview.forEach((row, i) => {
      const full = row || [];
      const cells = full.slice(0, EDIT_MAX_COLS).map(v => _truncSchemaCell(v, EDIT_MAX_CELL_LEN));
      const omitted = full.length > EDIT_MAX_COLS ? ` …(${full.length - EDIT_MAX_COLS}열 생략)` : "";
      lines.push(`  ${i + 1}: [${cells.join(", ")}]${omitted}`);
    });
    if (aoa.length > limit) lines.push(`  ... (${aoa.length - limit}행 생략)`);
  });
  if (sheetNames.length > EDIT_MAX_SHEETS) {
    lines.push(`  ... (시트 ${sheetNames.length - EDIT_MAX_SHEETS}개 더 생략)`);
  }
  return lines;
}

function buildEditingContext(editIdx) {
  const step = state.pipeline[editIdx];
  const lines = [];
  lines.push("## 수정 대상 단계");
  lines.push(`전체 ${state.pipeline.length}단계 중 Step ${editIdx + 1}을 수정합니다.`);
  lines.push(`기존 설명: "${step.description}"`);

  lines.push("\n## 이 단계의 현재 코드 (수정 대상)");
  // 0.4.11 라이브 엔진은 VBA 다. 수정 대상 코드의 실제 언어로 펜스를 표기해야
  // 모델이 'python 코드'로 오인해 엉뚱하게 다시 쓰는 일을 막는다.
  let _editFenceLang = "vba";
  if (typeof inferPipelineStepLanguage === "function") {
    const _lng = inferPipelineStepLanguage(step);
    _editFenceLang = _lng === "python" ? "python" : (_lng === "javascript" ? "javascript" : "vba");
  } else if (step.language === "python" || step.language === "javascript") {
    _editFenceLang = step.language;
  }
  lines.push("```" + _editFenceLang);
  lines.push(step.code);
  lines.push("```");

  if (state.pipeline.length > 1) {
    lines.push("\n## 파이프라인 전체 단계 (참고)");
    state.pipeline.forEach((s, i) => {
      const marker = i === editIdx ? " (editing target)" : "";
      lines.push(`  Step ${i + 1}. ${s.description}${marker}`);
    });
  }

  const before = (typeof computeStateBeforeStep === "function")
    ? computeStateBeforeStep(editIdx)
    : null;

  if (editIdx === 0) {
    lines.push("\n## 이 단계 직전 데이터 상태 (= 원본, 이전 단계 없음)");
  } else {
    lines.push(`\n## 이 단계 직전 데이터 상태 (Step 1 ~ ${editIdx} 적용 결과)`);
  }

  if (before) {
    lines.push("\n### 입력 파일");
    state.inputsOriginal.forEach(orig => {
      const sheets = before.inputsMap[orig.name] || orig.sheets;
      lines.push(`\n#### ${orig.name}`);
      lines.push(...previewSheets(sheets, 5));
    });
    if (state.outputOriginal) {
      lines.push(`\n### 출력 템플릿 ${state.outputOriginal.name}`);
      lines.push(...previewSheets(before.outputSheets, 30));
    }
  } else {
    lines.push("(직전 상태 시뮬레이션 실패. 원본 데이터를 참고하세요.)");
    state.inputsOriginal.forEach(orig => {
      lines.push(`\n#### ${orig.name}`);
      lines.push(...previewSheets(orig.sheets, 5));
    });
    if (state.outputOriginal) {
      lines.push(`\n### 출력 템플릿 ${state.outputOriginal.name}`);
      lines.push(...previewSheets(state.outputOriginal.sheets, 30));
    }
  }

  const text = lines.join("\n");
  const maxChars = EDIT_CONTEXT_TOKEN_BUDGET * SCHEMA_CHARS_PER_TOKEN;
  if (text.length > maxChars) {
    return text.slice(0, maxChars) + "\n... (수정 컨텍스트가 토큰 한도를 넘어 일부 생략됨)";
  }
  return text;
}

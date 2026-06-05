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
`;

const PYTHON_EXCEL_SKILL_RULE = `
ver4.x execution rule:
- Generate Python for real Microsoft Excel automation. Do not generate JavaScript or array-only simulator code.
- Return exactly one fenced \`\`\`python code block.
- Required signature:
  def transform(ctx):
      ...
- ctx.workbook is the output workbook. ctx.excel is the Excel Application.
- Use ctx.sheet("sheet name") for output sheets and ctx.input("file or sheet hint") for input workbooks.
- Prefer ctx.input("file hint").sheet("sheet name") over raw wb.Worksheets("sheet name").
- For tabular reads, prefer rows = ctx.rows(ws) and column lookup via ctx.col(ws, "header"). ctx.col returns a 1-based Excel column number; subtract 1 only when indexing Python row tuples/lists.
- Do not assume headers are always data[0]. If a header might be below row 1, use ctx.header_row(ws), ctx.data_start_row(ws), or ctx.col(ws, "header").
- When iterating tabular rows after finding columns, skip header rows:
  rows = ctx.rows(ws)
  start = ctx.data_start_row(ws) - 1
  for row in rows[start:]:
      ...
- Excel uses 1-based addresses. Prefer ws.Range("B61").Value = value for explicit selected ranges.
- When the user asks to overwrite a formula with a value, assign the value directly to that Excel Range. This removes the formula in Excel.
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
`;

// 스킬 실행 엔진(Python/openpyxl)이 선택됐을 때 프롬프트에 덧붙이는 안내.
// Excel(COM) 엔진이면 빈 문자열(기본 프롬프트가 COM 기준이라 그대로 사용).
function skillEnginePromptNote() {
  const engine = typeof getSkillEngine === "function" ? getSkillEngine() : "excel";
  if (engine !== "python") return "";
  return `
## 실행 엔진: 순수 Python(openpyxl) — 현재 선택됨
- 코드는 실제 Excel(COM)이 아니라 openpyxl 워크북 위에서 인프로세스로 실행됩니다(빠름).
- 기존 ctx API와 \`ws.Range("B61").Value\` / \`ws.Cells(r, c).Value\` (읽기·쓰기)는 그대로 사용할 수 있습니다.
- ctx 헬퍼 우선: ctx.sheet, ctx.input, ctx.rows, ctx.col, ctx.header_row, ctx.data_start_row, ctx.add_sheet, ctx.sort, ctx.filter_to_sheet, ctx.pivot, ctx.normalize.
- openpyxl 워크시트 메서드도 사용 가능: \`ws.cell(row=r, column=c).value\`, \`ws.insert_cols(idx, amount)\`, \`ws.insert_rows(idx, amount)\`, \`ws.delete_cols(idx, amount)\`, \`ws.delete_rows(idx, amount)\`, \`ws.append([...])\`, \`ws.max_row\`, \`ws.max_column\`.
- 사용 불가(COM 전용 — 호출하지 마세요): AutoFilter, Range.End, Range.Offset, Worksheet.Copy, Columns(i).Insert(), ctx.excel(=None).
- 입력 파일 읽기: 수식이 있어도 ctx.rows / ws.Range().Value 는 **계산된 값**을 돌려줍니다(파일에 저장된 계산 결과). 그대로 읽으면 됩니다.
- 출력 파일 수식: 기존 수식은 **보존**되며, 빈칸을 채우면 그 수식들은 파일을 Excel에서 열 때 **자동 재계산**되어 새 값이 보입니다. 즉 수식 셀을 직접 덮어쓸 필요 없이 입력 셀(예: 빈칸)만 채우면 됩니다.
- 단, **이번 단계에서 쓴 값으로 계산되는 수식의 결과를 같은 코드 안에서 다시 읽지는 마세요**(openpyxl 은 그 자리에서 계산하지 않습니다). 결과 값이 필요하면 Python 에서 직접 계산하세요.
- 입력 파일은 **읽기 전용**입니다(이 엔진에서 입력 파일 자체를 수정·저장하지 않음). 입력 파일을 편집해야 하면 상단 토글을 **Excel** 엔진으로 바꾸세요.
- 열/행 삽입·삭제는 openpyxl의 ws.insert_cols/insert_rows/delete_cols/delete_rows 를 사용하세요(COM Insert/Delete 대신).
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
    lines.push("사용자가 파일/시트를 명시하지 않으면 현재 입력 파일을 읽기 대상으로 사용하세요. 결과를 써야 하면 출력 워크북에 작성하세요.");
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
- **정렬**: \`ctx.sort(ws, "컬럼명", ascending=True, header=True)\` — 내부에서 올바른 숫자 상수로 Range.Sort 호출.
- **필터**: \`ctx.filter_to_sheet(ws, lambda row: 조건, "결과시트명")\` — 헤더+조건에 맞는 행을 새 시트로 복사. 원본은 유지.
  - 예: \`ctx.filter_to_sheet(ws, lambda r: ctx.normalize(r[ctx.col(ws,"상태")-1]) == ctx.normalize("완료"), "완료건")\`
- **피벗(그룹 요약)**: \`ctx.pivot(ws, group_by="회사명", value="매출", agg="sum", dest_name="회사별요약")\`
  - group_by는 문자열 또는 리스트, agg는 "sum"/"count"/"avg"/"max"/"min". 새 시트에 요약 표를 만듭니다.
- **COM 상수 주의**: 샌드박스에서 \`win32com\` 및 그 상수(xlAscending, xlYes 등)는 import할 수 없습니다.
  직접 Range.Sort/PivotTable 등을 호출해야 하면 이름 상수 대신 **숫자 값**을 쓰세요(예: 오름차순 1, 내림차순 2, 헤더있음 1).
- AutoFilter를 최종 결과로 의존하지 마세요(읽기전용 미러에서 on/off 상태가 불안정). 필요하면 ctx.filter_to_sheet로 새 시트를 만드세요.

## import 규칙
- 표준 라이브러리 import는 허용됩니다(예: re, json, datetime, math, collections, itertools, functools, decimal, statistics, random 등).
- os, sys, subprocess, shutil, pathlib 등 시스템/파일 접근 모듈은 import할 수 없습니다.

## 수식 보존 규칙
- 다운로드 시 값을 바꾸지 않은 셀은 원본 xlsx의 수식과 서식을 유지합니다.
- 값을 쓰지 않는 셀을 불필요하게 다시 대입하지 마세요.
- 특정 셀에 값을 덮어쓰라고 한 경우에만 해당 Range.Value를 직접 대입하세요. 이때 Excel에서 기존 수식은 값으로 대체됩니다.
- 열/행 추가, 복사, 삭제가 필요하면 Excel COM의 Insert, Copy, Delete를 사용해 수식 참조가 Excel 방식으로 보정되게 하세요.

## 응답 형식
1. 코드 블록 앞에 반드시 "제목: 작업 내용 요약" 한 줄을 쓰세요.
2. 응답은 정확히 하나의 \`\`\`python 코드 블록을 포함해야 합니다.
3. 코드 블록 밖 설명은 1~2문장으로 짧게 쓰세요.
4. 외부 라이브러리는 사용하지 마세요. Python 표준 라이브러리와 Excel COM 객체만 사용하세요.
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
  lines.push("```python");
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

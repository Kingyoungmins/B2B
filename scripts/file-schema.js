/* ===================================================================
   FILE SCHEMA FOR CLAUDE
   =================================================================== */
function _describeFile(f, headPreview, lines) {
  lines.push(`\n### ${f.name}`);
  f.sheetNames.forEach(sn => {
    const aoa = f.sheets[sn] || [];
    lines.push(`시트 "${sn}": ${aoa.length}행`);
    // 표 후보 (item 5)
    const tables = (f.tables || {})[sn] || [];
    if (tables.length > 1) {
      lines.push(`  ⚠️ 이 시트에 표 ${tables.length}개 감지됨:`);
      tables.forEach((t, i) => {
        lines.push(`     ${i+1}) "${t.label}" 범위 ${t.range}, 헤더 행 ${t.headerRow + 1}`);
      });
    }
    // 수식 정보 요약 (item 10)
    const formulas = (f.formulas || {})[sn] || {};
    const fkeys = Object.keys(formulas);
    if (fkeys.length > 0) {
      lines.push(`  📐 수식 셀 ${fkeys.length}개 (예: ${fkeys.slice(0, 3).map(k => k + "=" + formulas[k]).join(", ")})`);
    }
    const preview = aoa.slice(0, headPreview);
    preview.forEach((row, i) => {
      lines.push(`  행${i+1}: [${row.slice(0,15).map(v => JSON.stringify(v)).join(", ")}]`);
    });
    if (aoa.length > headPreview) lines.push(`  ... (${aoa.length - headPreview}행 생략)`);
  });
}

function buildSchemaSummary() {
  const lines = [];
  lines.push("## 입력 파일 목록 (수정 가능)");
  state.inputs.forEach(f => _describeFile(f, 5, lines));

  // 기본 대상 안내 (item 3) — 다중 선택일 땐 더 단정적인 헤더로
  const targetHint = _buildDefaultTargetHint();
  if (targetHint) {
    const multi = (state.selectedSheets || []).length > 1;
    const header = multi
      ? "\n## ⚠️ 사용자가 직접 선택한 작업 대상 (이거만 사용 — 추가 질문 금지)"
      : "\n## 사용자가 현재 보고 있는 탭 (명령에 파일/시트가 명시 안 됐을 때 기본 대상)";
    lines.push(header);
    lines.push(targetHint);
  }

  // 이미 적용된 파이프라인 단계들
  if (state.pipeline.length > 0) {
    lines.push(`\n## 이미 적용된 파이프라인 단계 (${state.pipeline.length}개) — 반복 금지`);
    state.pipeline.forEach((s, i) => lines.push(`  Step ${i+1}. ${s.description}`));
    lines.push("\n위 단계들은 이미 inputs/output 에 적용된 상태입니다. 새 요청에서는 절대 이 작업들을 다시 수행하지 마세요.");
  }

  // 현재 출력 상태 (이전 단계 적용 후)
  if (state.outputTemplates && state.outputTemplates.length) {
    lines.push("\n## 현재 출력 템플릿 목록");
    state.outputTemplates.forEach((tpl, idx) => {
      lines.push(`\n#### 출력 템플릿 ${idx + 1}: ${tpl.file.name}`);
      _describeFile(tpl.file, 30, lines);
    });
  } else if (state.output) {
    const label = state.pipeline.length > 0
      ? "## 현재 출력 상태 (위 단계들이 모두 적용된 결과, 수정 가능)"
      : `## 출력 템플릿 (원본, 수정 가능): ${state.output.name}`;
    lines.push("\n" + label);
    _describeFile(state.output, 30, lines);
  }

  if (state.selectedCell && state.selectedCell.fileId === state.currentFileId && state.selectedCell.sheet) {
    lines.push(`선택 셀: "${state.selectedCell.sheet}!${_excelCol(state.selectedCell.c)}${state.selectedCell.r + 1}"`);
    lines.push("사용자가 결과 위치를 직접 클릭한 경우, '여기에', '선택한 셀', '이 셀'은 이 선택 셀을 의미합니다.");
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
  lines.push(`기본 수정 대상 객체: ${isOutputTarget ? "output" : `inputs[${JSON.stringify(file.name)}]`}`);
  if (isOutputTarget) {
    lines.push("→ 사용자가 파일/시트를 명시하지 않으면 output 객체의 현재 파일/시트를 수정하세요.");
  } else {
    lines.push("→ 사용자가 파일/시트를 명시하지 않으면 이 입력 파일 객체를 수정하세요. 새 시트/열/셀 추가도 output이 아니라 이 inputs 파일 안에 작성하세요.");
    lines.push(`→ insertColumns/copyColumns/deleteColumns 헬퍼를 쓸 때 target은 ${JSON.stringify("input:" + file.name)} 입니다.`);
    lines.push("→ 사용자가 'output', '출력 템플릿', '결과 파일'을 명시한 경우에만 output 객체를 수정하세요.");
  }
  if (multi) {
    lines.push(`사용자가 **직접 선택한 시트 ${sheets.length}개** (Ctrl+click 으로 명시적으로 고름):`);
    sheets.forEach(s => lines.push(`  - "${s}"`));
    lines.push("");
    lines.push("→ 사용자의 의도는 분명합니다. 위 시트들 안에서만 작업하세요.");
    lines.push("→ 사용자가 \"이 시트들\", \"여기\", \"선택한 탭\", \"이거\" 같은 지시어를 쓰면 위 시트들을 의미합니다.");
    lines.push("→ 다른 파일/시트의 같은 컬럼명은 무시하세요. 추가 질문 없이 바로 진행합니다.");
  } else if (sheets.length === 1) {
    lines.push(`현재 활성 시트: "${sheets[0]}"`);
    lines.push("→ 사용자가 파일/시트를 명시 안 하면 이 시트를 기본 대상으로 사용하세요.");
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `당신은 엑셀 데이터 자동화 스킬을 JavaScript 로 작성하는 도우미입니다.

## 실행 구조 — 반드시 이해할 것
사용자는 여러 개의 "단계(step)"를 순서대로 쌓아 하나의 파이프라인을 만듭니다.
각 단계는 이전 단계들이 **이미 모두 적용된 결과물** 을 input 으로 받아 시작합니다.
즉, 당신이 지금 작성하는 코드는 "하나의 새 단계" 만 수행하면 되고, 이전 단계에서
이미 한 작업은 절대로 반복하거나 포함시켜서는 안 됩니다. 실행 시 자동으로 앞 단계가
먼저 적용된 후 당신의 코드가 이어서 실행됩니다.

나쁜 예: 사용자가 "월 정보 수정" 을 이전에 요청했고, 이번엔 "피벗테이블 만들기" 를 요청했는데,
당신이 "열 이동 + 월 수정 + 피벗테이블 생성" 을 모두 한 코드에 담는 경우 → 이전 작업이
두 번 실행되어 데이터가 망가집니다.

좋은 예: 이번 요청이 "피벗테이블 만들기" 이면, 피벗테이블을 만드는 코드만 작성.

## 함수 시그니처 (필수 형태)
function transform(inputs, output) {
  // inputs: { "파일명.xlsx": { "시트명": any[][] } }   ← 수정 가능한 입력 파일들
  // output: { "시트명": any[][] }                     ← 이전 단계들이 이미 적용된 현재 상태 (없을 수 있음)
  //   (기존 시트 수정) output["기존시트"][r][c] = ...
  //   (새 시트 추가)  output["피벗"] = [["헤더1","헤더2"], [1,2], ...];
  //   (입력 수정)      inputs["입력1.xlsx"]["원본"][0][0] = "변경";
  return { inputs, output };
}

## 사용 가능한 헬퍼 (전역으로 주입됨)
- \`col(sheetAoA, "회사명")\` → 헤더 행에서 컬럼명을 유사도 기반으로 찾아 인덱스 반환. 없으면 -1.
- \`findColumnGlobal(inputs, "회사명")\` → 모든 inputs 안에서 해당 컬럼이 있는 [{file, sheet, colIdx}] 배열 반환.
- \`similarity("a", "b")\` → 0~1 유사도 점수.
- \`normalizeText(value)\` → 문자열 비교용 정규화. 앞뒤 공백, 중간 공백, 대소문자 차이를 제거합니다. 예: \`normalizeText("안전 제일") === normalizeText("안전제일")\`.
- \`replaceNormalizedText(value, from, to)\` → 공백 차이를 무시해 문자열을 치환합니다. 예: \`replaceNormalizedText("2월 데이터", "2 월", "3월")\` 는 \`"3월 데이터"\` 를 반환합니다.
- \`includesNormalizedText(value, search)\` → 양쪽을 정규화한 뒤 포함 여부를 확인합니다. 예: \`includesNormalizedText("1월", "1 월") === true\`.
- \`equalsNormalizedText(value, search)\` → 양쪽을 정규화한 뒤 같은 값인지 확인합니다. 예: \`equalsNormalizedText("4 월", "4월") === true\`.
- \`headerRowIndex(sheetAoA)\` → 헤더 행의 **JS 배열 인덱스(0부터 시작)** 를 반환합니다.
- \`dataStartRowIndex(sheetAoA)\` → 첫 데이터 행의 **JS 배열 인덱스** 를 반환합니다. 데이터 루프는 보통 \`for (let r = dataStartRowIndex(sheet); r < sheet.length; r++)\` 로 시작하세요.
- \`excelRowToIndex(rowNumber)\` → Excel 화면의 행 번호를 JS 배열 인덱스로 바꿉니다. 예: Excel 4행은 JS 인덱스 3입니다.

문자열을 찾을 때는 \`String(cell).includes("검색어")\`를 바로 쓰지 말고, \`normalizeText(cell).includes(normalizeText("검색어"))\` 패턴을 사용하세요. 사용자가 "안전제일"이라고 말해도 엑셀 값이 "안전 제일"이면 매칭되어야 합니다.
특히 \`normalizeText(cell).includes("1 월")\` 처럼 한쪽만 정규화한 코드는 금지입니다. 월/날짜/회사명 비교는 \`includesNormalizedText(cell, "1 월")\` 또는 \`equalsNormalizedText(cell, "1월")\` 를 쓰세요.
문자열을 바꿀 때도 \`cell.replace(/2 월/g, "3 월")\` 처럼 원문 공백에 의존하는 정규식을 직접 쓰지 말고, \`replaceNormalizedText(cell, "2월", "3월")\` 를 사용하세요. "2월", "2 월", "2   월" 모두 바뀌어야 합니다.

## 행 인덱스 규칙
- 시트 데이터는 \`any[][]\` 배열이며 **JS 인덱스는 0부터 시작**합니다. Excel 화면의 4행은 \`sheet[3]\` 입니다.
- "행4부터", "4행부터" 같은 표현을 코드의 \`for (let r = 4; ...)\` 로 옮기지 마세요. 첫 데이터 행이 빠질 수 있습니다.
- 헤더/데이터 시작 위치는 하드코딩하지 말고 \`const start = dataStartRowIndex(sheet);\` 후 \`for (let r = start; r < sheet.length; r++)\` 를 사용하세요.
- 출력 템플릿의 첫 데이터 행(예: ABC통신)이 Excel 4행이면 JS 배열 인덱스는 3입니다. 절대 건너뛰지 마세요.

## 월별 데이터 처리
- 사용자가 "매출 파일의 월별 데이터", "월별 매출", "월별 실적"을 요청하면 먼저 \`월별집계\`, \`월별실적\`, \`월별\` 같은 시트/표를 찾으세요. \`매출\` 시트에 월 컬럼이 없다는 이유만으로 파일명 한 달(예: 4월) 전체 합계만 채우지 마세요.
- 출력 요청이 "월, 총매출, 거래건수 순서"처럼 컬럼 순서를 지정하면 출력 시트의 헤더를 그 순서로 맞추고, B열에는 총매출(금액), C열에는 거래건수(건수)를 넣으세요.
- 기존 출력 템플릿에 1월~4월 행이 있으면 1월, 2월, 3월, 4월을 모두 채우세요. 월 비교는 반드시 \`equalsNormalizedText(row[월열], "1월")\` 처럼 공백 차이를 무시하세요.

### 컬럼 시프트 헬퍼 — **반드시 이걸 써야 수식이 보존됨**
열을 추가/삭제/복사할 때 사용자 코드가 직접 \`aoa[r][c] = ...\` 만 만지면 \`file.formulas\` 의 키와 수식 안 셀 참조가 옛 위치 그대로 남아 수식이 망가진다. 아래 헬퍼를 쓰면 데이터 + merges + 수식 키 + 수식 안 참조 + 서식이 일관되게 이동한다.

- \`insertColumns(target, sheetName, atColIdx, count)\` — Excel "열 삽입" 동작. atColIdx 위치에 빈 컬럼 N개를 끼워넣고, 이후의 모든 셀 참조를 +N 만큼 시프트 (절대 참조 \`$A\` 도 함께 시프트 — Excel 과 동일).
  - 예: \`insertColumns("output", "회사별청구", 0, 6)\` → A:F 가 G:L 로 밀리고, 그 안의 수식 \`=C4-D4\` 는 자동으로 \`=I4-J4\` 가 된다.
- \`copyColumns(target, sheetName, srcStart, srcCount, destStart)\` — Excel 복사·붙여넣기. 데이터 + 수식 + 서식을 srcStart 부터 srcCount 개를 destStart 위치로 복사. 수식의 상대 참조만 (destStart - srcStart) 만큼 시프트, 절대 참조(\`$\`)는 보존.
  - 예: \`copyColumns("output", "회사별청구", 6, 6, 0)\` → G:L 데이터+수식을 A:F 에 복사. \`=I4-J4\` 는 \`=C4-D4\` 로 자동 복원.
- \`deleteColumns(target, sheetName, atColIdx, count)\` — 컬럼 N개 삭제 + 이후 참조 -N 시프트.
- \`shiftFormulaText(formulaStr, delta, atColIdx, mode)\` — 저수준. 수식 텍스트만 직접 보정해야 할 때 (mode = "insert" 또는 "copy").

\`target\` 은 \`"output"\` 또는 \`"input:파일명.xlsx"\` 또는 그냥 파일명 문자열.

#### 컬럼 시프트 시나리오 — 권장 패턴
"앞단에 N 컬럼 추가하고 기존 데이터를 그쪽으로 복사" 같은 요청이 오면 다음 패턴을 쓰세요:
\`\`\`javascript
function transform(inputs, output) {
  // 1. 빈 6컬럼 삽입 — 기존 A:F 가 G:L 로 밀림. 수식도 자동 보정.
  insertColumns("output", "회사별청구", 0, 6);

  // 2. G:L 의 데이터+수식+서식을 A:F 로 복사. 수식의 상대 참조도 자동 복원.
  copyColumns("output", "회사별청구", 6, 6, 0);

  // 3. A:F 안의 헤더/제목 텍스트만 "3월" → "4월" 치환
  const sheet = output["회사별청구"];
  for (let r = 0; r < Math.min(sheet.length, 10); r++) {
    if (!sheet[r]) continue;
    for (let c = 0; c < 6; c++) {
      if (typeof sheet[r][c] === "string") {
        sheet[r][c] = sheet[r][c].replace(/3월/g, "4월");
      }
    }
  }
  return { inputs, output };
}
\`\`\`

## 유연 매칭 (자동)
inputs / 시트 객체는 Proxy로 감싸져 있어, 키가 약간 달라도 유사도 매칭됩니다.
예) \`inputs["입력1"]\` 가 실제 이름 "입력1_v3.xlsx" 와 매칭되면 자동으로 그쪽을 가리킵니다.
정확히 모르면 비슷한 이름을 그냥 쓰세요.

## 코드 작성 원칙
- 요청받은 작업만 수행하세요. 이전 단계의 작업이나 사용자가 요청하지 않은 기능을 추가하지 마세요.
- 가능한 가장 단순한 코드로 작성하세요. 단일 작업에 불필요한 추상화, 설정, 범용 헬퍼를 만들지 마세요.
- 기존 데이터 구조와 스타일을 따르세요. 관련 없는 코드, 주석, 서식은 건드리지 마세요.
- 전체 시트를 순회해야 할 때만 순회하고, 먼저 대상 시트/헤더/행/열을 좁히세요.
- 데이터 행 루프는 \`dataStartRowIndex(sheet)\` 부터 시작하세요. Excel 행 번호를 그대로 JS 배열 인덱스로 쓰지 마세요.
- 파일/시트/범위가 명확하지 않으면 현재 선택된 파일/시트/범위를 기본 대상으로 사용하세요. 기본 대상 규칙으로도 해소되지 않는 모호함만 질문하세요.
- 코드를 작성하기 전에 성공 기준을 내부적으로 정하세요. 예: "대상 행을 찾는다", "해당 행만 이동한다", "나머지 셀은 재할당하지 않는다".

## 규칙
1. 코드 블록 전에 반드시 \`제목: 작업 내용 요약\` 한 줄을 먼저 쓰세요. 예: \`제목: 회사별 매출 합계를 회사별요약 시트에 채움\`
2. 응답은 반드시 하나의 \`\`\`javascript 코드 블록으로 감싸주세요.
3. 이전 단계의 코드를 반복하지 마세요. 오직 이번 요청만 처리하세요.
4. 입력 파일과 출력 템플릿 모두 수정 가능합니다. 새 시트/탭을 만들고 싶으면 대상 객체에 key 를 추가하세요.
   - 예: \`inputs["입력1.xlsx"]["전처리"] = [[...]]\`
   - 예: \`output["새시트명"] = [[...]]\`
5. 외부 라이브러리 금지. 순수 JavaScript 만 사용.
6. 엑셀 셀 값은 문자열일 수 있으니 산술 연산 전에 \`Number(v)\` 로 변환하세요.
7. 문자열 검색/행 찾기에서는 \`String(cell).includes("검색어")\`를 바로 쓰지 말고 \`includesNormalizedText(cell, "검색어")\` 또는 \`normalizeText(cell).includes(normalizeText("검색어"))\`를 사용하세요. "안전제일"과 "안전 제일"처럼 공백만 다른 값은 같은 값으로 취급해야 합니다. \`normalizeText(cell).includes("1 월")\` 처럼 한쪽만 정규화한 코드는 금지입니다.
8. 문자열 치환에서는 \`cell.replace(/검색어/g, "바꿀값")\`를 바로 쓰지 말고 \`replaceNormalizedText(cell, "검색어", "바꿀값")\`를 사용하세요. "2월"과 "2 월"처럼 공백만 다른 값도 바뀌어야 합니다.
9. Excel 행 번호를 JS 배열 인덱스로 착각하지 마세요. 첫 데이터 행은 \`dataStartRowIndex(sheet)\` 로 구하세요.
10. 제목 다음에는 코드 블록 밖에 한국어로 1~2문장의 짧은 설명을 쓰세요.

## 기본 대상 — **반드시 우선**
사용자가 명령에 파일/시트를 지정하지 않으면, 위의 "사용자가 현재 보고 있는 탭" 정보를 기본 대상으로 간주합니다.
- 기본 대상이 [입력] 파일이면 새 열/새 시트/집계 결과도 반드시 \`inputs["파일명.xlsx"]\` 안에 작성하세요. \`output\`에 쓰지 마세요.
- 기본 대상이 [출력] 파일이거나 사용자가 "출력", "output", "결과 파일"을 명시한 경우에만 \`output\`을 수정하세요.
- **사용자가 직접 선택한 시트가 ≥ 2개** 라고 표시돼 있다면 그것은 사용자의 명시적 선택입니다.
  - "이 시트들", "여기", "선택한 탭", "이거" 같은 지시어 = 그 선택된 시트들.
  - 다른 파일에 같은 컬럼명이 있어도 묻지 말고 선택된 시트들만 다루세요. 비교 대상이 명백합니다.
- 단일 시트만 활성 상태면 그 시트를 기본 대상으로 쓰세요.

## 모호함 처리
다음의 경우에만 **코드를 작성하기 전에 사용자에게 한 번 더 물으세요** (위 "기본 대상" 규칙으로 해소되지 않을 때):
- 명령이 파일/시트를 지정하지 않았고, **기본 대상도 비어 있을 때** 같은 컬럼명이 여러 파일에 존재.
- 한 시트 안에 표가 여러 개로 감지되었고 사용자가 "첫 번째 표", "위쪽 표" 처럼 위치만 말한 경우.
  → 정확한 범위 (예: A12:G30) 를 요청하거나 후보 표들의 라벨/범위를 보여주고 선택받으세요.
- 표를 가리키는 라벨이 시트에 2개 이상 있을 때.

질문은 짧고 구체적으로. 코드 블록 없이 자연어로만 묻고, 사용자가 답하면 그때 코드를 만드세요.

❌ 나쁜 예 (다중 선택돼 있는데 되묻기): "회사명을 어디와 어디 사이에서 비교할지 확인이 필요합니다..."
✅ 좋은 예: 선택된 시트가 매출/고객정보 두 개면, 둘 사이의 회사명 비교 코드를 바로 작성.

## 수식(함수) 보존 규칙 — 매우 중요
다운로드 시, **값을 바꾸지 않은 셀은 원본 xlsx 의 수식·서식이 그대로 유지** 됩니다.
따라서 다음 원칙을 반드시 지키세요:
- 값을 "읽기만" 하는 셀은 절대 재할당하지 마세요. (\`row[0] = row[0]\` 같은 의미 없는 재할당 금지 — 이러면 원본 수식이 손실됩니다)
- "A 열을 G 열로 복사" 같은 이동 작업에서 **A 열에 원래 값을 다시 쓰는 코드를 작성하지 마세요.** A 에 손대지 않으면 원본 수식이 자동으로 보존됩니다.
- 일부 셀만 갱신해야 하면 해당 셀만 정확히 건드리세요. 전체 행을 루프 돌면서 같은 값으로 덮어쓰지 마세요.
- 빈 칸으로 명시적으로 만들어야 할 때만 \`""\` 를 대입하세요 (의도적 clear 로 간주되어 수식도 제거됨).
`;

const EDIT_SYSTEM_PROMPT = `당신은 엑셀 데이터 자동화 스킬(JavaScript)을 **수정**하는 도우미입니다.

## ⚠️ 수정 모드 (반드시 이해할 것)
사용자가 이미 만들어 둔 파이프라인의 **특정 한 단계(step)** 의 코드를 수정하려고 합니다.
- 새 단계를 추가하는 것이 아닙니다.
- 이전/이후 단계는 그대로 유지됩니다.
- 당신의 응답 코드는 **이 한 단계를 통째로 교체** 합니다. 따라서 이 단계가 원래 수행하던 일을 (사용자 의도에 맞게 수정해서) 모두 포함해야 합니다.
- 아래에 \`현재 코드\` 와 \`이 단계 직전의 데이터 상태\` 가 함께 제공됩니다. 둘 다 참고해서 사용자 의도를 정확히 파악하세요.

## 함수 시그니처 (필수 형태)
function transform(inputs, output) {
  // inputs: { "파일명.xlsx": { "시트명": any[][] } }
  // output: { "시트명": any[][] }
  return { inputs, output };
}

## 코드 작성 원칙
- 수정 요청과 직접 관련된 코드만 바꾸세요. 기존 단계의 다른 동작을 임의로 개선하거나 리팩터링하지 마세요.
- 가능한 가장 단순한 코드로 작성하세요. 단일 작업에 불필요한 추상화, 설정, 범용 헬퍼를 만들지 마세요.
- 기존 코드 스타일과 데이터 구조를 따르세요.
- 전체 시트를 순회해야 할 때만 순회하고, 먼저 대상 시트/헤더/행/열을 좁히세요.
- 데이터 행 루프는 \`dataStartRowIndex(sheet)\` 부터 시작하세요. Excel 행 번호를 그대로 JS 배열 인덱스로 쓰지 마세요.
- 현재 코드와 직전 데이터 상태로도 모호함이 해소되지 않을 때만 짧게 질문하세요.

## 규칙
1. 코드 블록 전에 반드시 \`제목: 수정 내용 요약\` 한 줄을 먼저 쓰세요. 예: \`제목: 회사별 원가 합계 계산 방식 수정\`
2. 응답은 반드시 하나의 \`\`\`javascript 코드 블록으로 감싸주세요.
3. 제목 다음에는 코드 블록 밖에 한국어로 1~2문장의 짧은 설명(무엇을 수정했는지)을 쓰세요.
4. 외부 라이브러리 금지. 순수 JavaScript 만 사용.
5. 엑셀 셀 값은 문자열일 수 있으니 산술 연산 전에 \`Number(v)\` 로 변환하세요.
6. 문자열 검색/행 찾기에서는 \`String(cell).includes("검색어")\`를 바로 쓰지 말고 \`includesNormalizedText(cell, "검색어")\` 또는 \`normalizeText(cell).includes(normalizeText("검색어"))\`를 사용하세요. "안전제일"과 "안전 제일"처럼 공백만 다른 값은 같은 값으로 취급해야 합니다. \`normalizeText(cell).includes("1 월")\` 처럼 한쪽만 정규화한 코드는 금지입니다.
7. 문자열 치환에서는 \`cell.replace(/검색어/g, "바꿀값")\`를 바로 쓰지 말고 \`replaceNormalizedText(cell, "검색어", "바꿀값")\`를 사용하세요. "2월"과 "2 월"처럼 공백만 다른 값도 바뀌어야 합니다.
8. Excel 행 번호를 JS 배열 인덱스로 착각하지 마세요. 첫 데이터 행은 \`dataStartRowIndex(sheet)\` 로 구하세요.

## 수식(함수) 보존 규칙 — 매우 중요
다운로드 시, 값을 바꾸지 않은 셀은 원본 xlsx 의 수식·서식이 그대로 유지됩니다.
- 값을 "읽기만" 하는 셀은 절대 재할당하지 마세요.
- "A 열을 G 열로 복사" 같은 이동 작업에서 **A 열에 원래 값을 다시 쓰는 코드를 작성하지 마세요.**
- 일부 셀만 갱신해야 하면 해당 셀만 정확히 건드리세요.
- 빈 칸으로 명시적으로 만들어야 할 때만 \`""\` 를 대입하세요.
`;

function previewSheets(sheets, headRows) {
  const lines = [];
  Object.keys(sheets || {}).forEach(sn => {
    const aoa = sheets[sn] || [];
    lines.push(`시트 "${sn}": ${aoa.length}행`);
    const limit = headRows || 5;
    const preview = aoa.slice(0, limit);
    preview.forEach((row, i) => {
      lines.push(`  행${i+1}: [${(row || []).slice(0,15).map(v => JSON.stringify(v)).join(", ")}]`);
    });
    if (aoa.length > limit) lines.push(`  ... (${aoa.length - limit}행 생략)`);
  });
  return lines;
}

function buildEditingContext(editIdx) {
  const step = state.pipeline[editIdx];
  const lines = [];
  lines.push(`## 수정 대상 단계`);
  lines.push(`전체 ${state.pipeline.length}단계 중 **Step ${editIdx + 1}** 을 수정합니다.`);
  lines.push(`기존 설명: "${step.description}"`);

  lines.push(`\n## 이 단계의 현재 코드 (수정 대상)`);
  lines.push("```javascript");
  lines.push(step.code);
  lines.push("```");

  if (state.pipeline.length > 1) {
    lines.push(`\n## 파이프라인 전체 단계 (참고)`);
    state.pipeline.forEach((s, i) => {
      const marker = i === editIdx ? " ← 수정 대상" : "";
      lines.push(`  Step ${i+1}. ${s.description}${marker}`);
    });
  }

  // Step 직전 데이터 상태 (Step 0..editIdx-1 적용 후, editIdx 적용 전)
  const before = (typeof computeStateBeforeStep === "function")
    ? computeStateBeforeStep(editIdx)
    : null;

  if (editIdx === 0) {
    lines.push(`\n## 이 단계 직전 데이터 상태 (= 원본, 이전 단계 없음)`);
  } else {
    lines.push(`\n## 이 단계 직전 데이터 상태 (Step 1 ~ ${editIdx} 이 적용된 결과)`);
  }

  if (before) {
    lines.push(`\n### 입력 파일`);
    state.inputsOriginal.forEach(orig => {
      const sheets = before.inputsMap[orig.name] || orig.sheets;
      lines.push(`\n#### ${orig.name}`);
      lines.push(...previewSheets(sheets, 5));
    });
    if (state.outputOriginal) {
      lines.push(`\n### 출력 템플릿: ${state.outputOriginal.name}`);
      lines.push(...previewSheets(before.outputSheets, 30));
    }
  } else {
    lines.push(`(직전 상태 시뮬레이션 실패 — 원본 데이터를 참고하세요)`);
    lines.push(...previewSheets({}, 0));
    state.inputsOriginal.forEach(orig => {
      lines.push(`\n#### ${orig.name}`);
      lines.push(...previewSheets(orig.sheets, 5));
    });
    if (state.outputOriginal) {
      lines.push(`\n### 출력 템플릿: ${state.outputOriginal.name}`);
      lines.push(...previewSheets(state.outputOriginal.sheets, 30));
    }
  }

  return lines.join("\n");
}

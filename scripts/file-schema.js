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
  if (state.output) {
    const label = state.pipeline.length > 0
      ? "## 현재 출력 상태 (위 단계들이 모두 적용된 결과, 수정 가능)"
      : `## 출력 템플릿 (원본, 수정 가능): ${state.output.name}`;
    lines.push("\n" + label);
    _describeFile(state.output, 30, lines);
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
  const tag = state.currentFileId === "output" ? "[출력]" : "[입력]";
  const multi = sheets.length > 1;
  const lines = [];
  lines.push(`${tag} 파일: "${file.name}"`);
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

const SYSTEM_PROMPT = `당신은 엑셀 데이터 자동화 로직을 JavaScript 로 작성하는 도우미입니다.

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

## 유연 매칭 (자동)
inputs / 시트 객체는 Proxy로 감싸져 있어, 키가 약간 달라도 유사도 매칭됩니다.
예) \`inputs["입력1"]\` 가 실제 이름 "입력1_v3.xlsx" 와 매칭되면 자동으로 그쪽을 가리킵니다.
정확히 모르면 비슷한 이름을 그냥 쓰세요.

## 규칙
1. 응답은 반드시 하나의 \`\`\`javascript 코드 블록으로 감싸주세요.
2. 이전 단계의 코드를 반복하지 마세요. 오직 이번 요청만 처리하세요.
3. 입력 파일과 출력 템플릿 모두 수정 가능합니다. 새 시트/탭을 만들고 싶으면 대상 객체에 key 를 추가하세요.
   - 예: \`inputs["입력1.xlsx"]["전처리"] = [[...]]\`
   - 예: \`output["새시트명"] = [[...]]\`
4. 외부 라이브러리 금지. 순수 JavaScript 만 사용.
5. 엑셀 셀 값은 문자열일 수 있으니 산술 연산 전에 \`Number(v)\` 로 변환하세요.
6. 코드 블록 밖에 한국어로 1~2문장의 짧은 설명을 쓰세요.

## 기본 대상 — **반드시 우선**
사용자가 명령에 파일/시트를 지정하지 않으면, 위의 "사용자가 현재 보고 있는 탭" 정보를 기본 대상으로 간주합니다.
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

const EDIT_SYSTEM_PROMPT = `당신은 엑셀 데이터 자동화 로직(JavaScript)을 **수정**하는 도우미입니다.

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

## 규칙
1. 응답은 반드시 하나의 \`\`\`javascript 코드 블록으로 감싸주세요.
2. 코드 블록 밖에 한국어로 1~2문장의 짧은 설명(무엇을 수정했는지)을 쓰세요.
3. 외부 라이브러리 금지. 순수 JavaScript 만 사용.
4. 엑셀 셀 값은 문자열일 수 있으니 산술 연산 전에 \`Number(v)\` 로 변환하세요.

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

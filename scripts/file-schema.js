/* ===================================================================
   FILE SCHEMA FOR CLAUDE
   =================================================================== */
function buildSchemaSummary() {
  const lines = [];
  lines.push("## 입력 파일 목록 (수정 가능)");
  state.inputs.forEach(f => {
    lines.push(`\n### ${f.name}`);
    f.sheetNames.forEach(sn => {
      const aoa = f.sheets[sn];
      lines.push(`시트 "${sn}": ${aoa.length}행`);
      const preview = aoa.slice(0, 5);
      preview.forEach((row, i) => {
        lines.push(`  행${i+1}: [${row.slice(0,12).map(v => JSON.stringify(v)).join(", ")}]`);
      });
      if (aoa.length > 5) lines.push(`  ... (${aoa.length-5}행 생략)`);
    });
  });

  // 이미 적용된 파이프라인 단계들
  if (state.pipeline.length > 0) {
    lines.push(`\n## 이미 적용된 파이프라인 단계 (${state.pipeline.length}개) — 반복 금지`);
    state.pipeline.forEach((s, i) => {
      lines.push(`  Step ${i+1}. ${s.description}`);
    });
    lines.push("\n위 단계들은 이미 inputs/output 에 적용된 상태입니다. 새 요청에서는 절대 이 작업들을 다시 수행하지 마세요.");
  }

  // 현재 출력 상태 (이전 단계 적용 후)
  if (state.output) {
    const label = state.pipeline.length > 0
      ? "## 현재 출력 상태 (위 단계들이 모두 적용된 결과, 수정 가능)"
      : `## 출력 템플릿 (원본, 수정 가능): ${state.output.name}`;
    lines.push("\n" + label);
    state.output.sheetNames.forEach(sn => {
      const aoa = state.output.sheets[sn];
      lines.push(`\n시트 "${sn}": ${aoa.length}행`);
      const preview = aoa.slice(0, 30);
      preview.forEach((row, i) => {
        lines.push(`  행${i+1}: [${row.slice(0,15).map(v => JSON.stringify(v)).join(", ")}]`);
      });
      if (aoa.length > 30) lines.push(`  ... (${aoa.length-30}행 생략)`);
    });
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

## 규칙
1. 응답은 반드시 하나의 \`\`\`javascript 코드 블록으로 감싸주세요.
2. 이전 단계의 코드를 반복하지 마세요. 오직 이번 요청만 처리하세요.
3. 입력 파일과 출력 템플릿 모두 수정 가능합니다. 새 시트/탭을 만들고 싶으면 대상 객체에 key 를 추가하세요.
   - 예: \`inputs["입력1.xlsx"]["전처리"] = [[...]]\`
   - 예: \`output["새시트명"] = [[...]]\`
4. 외부 라이브러리 금지. 순수 JavaScript 만 사용.
5. 엑셀 셀 값은 문자열일 수 있으니 산술 연산 전에 \`Number(v)\` 로 변환하세요.
6. 코드 블록 밖에 한국어로 1~2문장의 짧은 설명을 쓰세요.

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

/* ===================================================================
   SHEET OPS  —  컬럼 삽입 / 복사 시 수식·서식·병합까지 일관되게 이동
   ===================================================================
   사용자 코드(LLM 생성) 가 직접 AoA 만 만지면 file.formulas 맵의 키와
   수식 텍스트가 옛 위치 그대로 남아 결과가 깨진다. 이 모듈은 Excel 의
   "열 삽입 / 잘라붙이기" 와 동일한 동작을:
     - sheet AoA
     - file.merges
     - file.formulas (키 + 수식 안 셀 참조)
     - file.originalFormulaValues
     - file.styles
   네 곳을 모두 일괄 보정해서 제공한다.
   =================================================================== */

function _colLettersToIdx(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}
function _idxToColLetters(n) {
  let s = ""; n++;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function _addrToRC(addr) {
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  if (!m) return null;
  return { c: _colLettersToIdx(m[1]), r: parseInt(m[2], 10) - 1 };
}

// 파일 레퍼런스 ("output" / "input:파일명" / 파일명 / 파일 record) 를 실제 파일 객체로 해석
function _resolveFileForOps(fileRef) {
  if (!fileRef) return null;
  if (typeof fileRef === "object" && fileRef.sheets) return fileRef;
  if (fileRef === "output") return state.output;
  if (typeof fileRef === "string" && fileRef.startsWith("output:")) {
    const idx = typeof outputTemplateIndexFromFileId === "function" ? outputTemplateIndexFromFileId(fileRef) : Number(fileRef.slice(7));
    return (state.outputTemplates[idx] && state.outputTemplates[idx].file) || null;
  }
  if (typeof fileRef === "string" && fileRef.startsWith("input:")) {
    const name = fileRef.slice(6);
    return state.inputs.find(f => f.name === name);
  }
  if (typeof fileRef === "string") {
    // 정확 매칭 우선, 그 다음 fuzzy
    const exact = state.inputs.find(f => f.name === fileRef) ||
                  (state.output && state.output.name === fileRef ? state.output : null);
    if (exact) return exact;
    if (typeof fuzzyMatch === "function") {
      const all = state.inputs.map(f => f.name);
      if (state.output) all.push(state.output.name);
      const r = fuzzyMatch(fileRef, all);
      if (r) {
        return state.inputs.find(f => f.name === r.match) ||
               (state.output && state.output.name === r.match ? state.output : null);
      }
    }
  }
  return null;
}

// 수식 텍스트 안의 셀 참조를 컬럼 방향으로 delta 만큼 이동.
//   mode = "insert" : 모든 참조 (atColIdx 이상) 가 delta 시프트  ← Excel 의 "열 삽입"
//   mode = "copy"   : 절대 참조 ($A1) 는 그대로 두고 상대 참조만 시프트  ← Excel 의 "복사·붙여넣기"
function shiftFormulaText(formulaStr, delta, atColIdx, mode) {
  if (!formulaStr) return formulaStr;
  if (delta === 0) return formulaStr;
  const _mode = mode || "insert";
  return String(formulaStr).replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (m, dol1, letters, dol2, row) => {
    const col = _colLettersToIdx(letters);
    if (col < atColIdx) return m;                 // 임계 이전 → 안 건드림
    if (_mode === "copy" && dol1 === "$") return m; // 절대 참조 + 복사 모드 → 유지
    return dol1 + _idxToColLetters(col + delta) + dol2 + row;
  });
}

// 시트 안 atColIdx 위치에 빈 컬럼 count 개 삽입. Excel 의 "열 삽입" 동작.
//   - 각 행에 빈 셀 count 개 splice
//   - merges 의 시작/끝 컬럼 보정
//   - formulas 의 키 + 수식 안 참조 모두 보정
//   - styles, originalFormulaValues 도 동일 보정
function insertColumns(fileRef, sheetName, atColIdx, count) {
  const file = _resolveFileForOps(fileRef);
  if (!file) throw new Error(`insertColumns: 파일을 찾을 수 없음: ${fileRef}`);
  const aoa = file.sheets[sheetName];
  if (!aoa) throw new Error(`insertColumns: 시트 없음: ${sheetName}`);
  if (count <= 0) return;
  const at = Math.max(0, atColIdx | 0);

  // 1. AoA: 행마다 atColIdx 위치에 빈 셀 count 개 삽입
  for (let r = 0; r < aoa.length; r++) {
    if (!aoa[r]) aoa[r] = [];
    // 행이 짧아 atColIdx 가 행 길이를 넘으면 우선 빈 칸으로 패딩
    while (aoa[r].length < at) aoa[r].push("");
    const fill = new Array(count).fill("");
    aoa[r].splice(at, 0, ...fill);
  }

  // 2. merges 시프트
  const merges = file.merges && file.merges[sheetName];
  if (Array.isArray(merges)) {
    merges.forEach(m => {
      if (m.s.c >= at) m.s.c += count;
      if (m.e.c >= at) m.e.c += count;
    });
  }

  // 3. formulas 키 + 수식 안 참조 시프트
  if (file.formulas && file.formulas[sheetName]) {
    const oldF = file.formulas[sheetName];
    const newF = {};
    Object.keys(oldF).forEach(addr => {
      const rc = _addrToRC(addr);
      if (!rc) { newF[addr] = oldF[addr]; return; }
      const newC = rc.c >= at ? rc.c + count : rc.c;
      const newAddr = _idxToColLetters(newC) + (rc.r + 1);
      newF[newAddr] = shiftFormulaText(oldF[addr], count, at, "insert");
    });
    file.formulas[sheetName] = newF;
  }

  // 4. originalFormulaValues 키 시프트
  if (file.originalFormulaValues && file.originalFormulaValues[sheetName]) {
    const oldV = file.originalFormulaValues[sheetName];
    const newV = {};
    Object.keys(oldV).forEach(addr => {
      const rc = _addrToRC(addr);
      if (!rc) { newV[addr] = oldV[addr]; return; }
      const newC = rc.c >= at ? rc.c + count : rc.c;
      newV[_idxToColLetters(newC) + (rc.r + 1)] = oldV[addr];
    });
    file.originalFormulaValues[sheetName] = newV;
  }

  // 5. styles 행마다 atColIdx 위치에 null count 개 삽입
  if (file.styles && file.styles[sheetName]) {
    const styles = file.styles[sheetName];
    for (let r = 0; r < styles.length; r++) {
      if (!styles[r]) continue;
      while (styles[r].length < at) styles[r].push(null);
      const fill = new Array(count).fill(null);
      styles[r].splice(at, 0, ...fill);
    }
  }
}

// 컬럼 범위 [srcStart, srcStart+srcCount) 를 destStart 위치로 복사.
// 데이터 + 수식 + 서식 모두 복사하며, 수식 참조는 (destStart - srcStart) 만큼 시프트.
// 단, 절대 참조 ($X) 는 보존 (Excel 의 복사·붙여넣기와 동일).
function copyColumns(fileRef, sheetName, srcStart, srcCount, destStart) {
  const file = _resolveFileForOps(fileRef);
  if (!file) throw new Error(`copyColumns: 파일을 찾을 수 없음: ${fileRef}`);
  const aoa = file.sheets[sheetName];
  if (!aoa) throw new Error(`copyColumns: 시트 없음: ${sheetName}`);
  if (srcCount <= 0) return;
  const delta = destStart - srcStart;
  if (delta === 0) return;

  // 1. AoA 데이터 복사
  for (let r = 0; r < aoa.length; r++) {
    if (!aoa[r]) aoa[r] = [];
    for (let c = 0; c < srcCount; c++) {
      const srcC = srcStart + c;
      const destC = destStart + c;
      while (aoa[r].length <= destC) aoa[r].push("");
      aoa[r][destC] = (aoa[r][srcC] !== undefined) ? aoa[r][srcC] : "";
    }
  }

  // 2. formulas 복사 + ref 시프트
  if (file.formulas && file.formulas[sheetName]) {
    const formulas = file.formulas[sheetName];
    // 스냅샷 — 복사 중 키가 추가되는 도중에 다시 읽지 않도록
    const snap = Object.keys(formulas)
      .map(addr => ({ addr, rc: _addrToRC(addr) }))
      .filter(x => x.rc && x.rc.c >= srcStart && x.rc.c < srcStart + srcCount);
    snap.forEach(({ addr, rc }) => {
      const newAddr = _idxToColLetters(rc.c + delta) + (rc.r + 1);
      formulas[newAddr] = shiftFormulaText(formulas[addr], delta, 0, "copy");
    });
  }

  // 3. styles 복사
  if (file.styles && file.styles[sheetName]) {
    const styles = file.styles[sheetName];
    for (let r = 0; r < styles.length; r++) {
      if (!styles[r]) continue;
      for (let c = 0; c < srcCount; c++) {
        const srcC = srcStart + c;
        const destC = destStart + c;
        while (styles[r].length <= destC) styles[r].push(null);
        styles[r][destC] = (styles[r][srcC] !== undefined) ? styles[r][srcC] : null;
      }
    }
  }
}

// 빈 컬럼 N개를 atColIdx 위치에서 제거 (insertColumns 의 역). 자주 안 쓰지만 대칭으로 제공.
function deleteColumns(fileRef, sheetName, atColIdx, count) {
  const file = _resolveFileForOps(fileRef);
  if (!file) throw new Error(`deleteColumns: 파일을 찾을 수 없음: ${fileRef}`);
  const aoa = file.sheets[sheetName];
  if (!aoa) throw new Error(`deleteColumns: 시트 없음: ${sheetName}`);
  if (count <= 0) return;
  const at = Math.max(0, atColIdx | 0);

  for (let r = 0; r < aoa.length; r++) if (aoa[r]) aoa[r].splice(at, count);

  const merges = file.merges && file.merges[sheetName];
  if (Array.isArray(merges)) {
    file.merges[sheetName] = merges.filter(m => !(m.s.c >= at && m.e.c < at + count))
      .map(m => {
        if (m.s.c >= at + count) m.s.c -= count;
        else if (m.s.c >= at) m.s.c = at;
        if (m.e.c >= at + count) m.e.c -= count;
        else if (m.e.c >= at) m.e.c = at - 1;
        return m;
      })
      .filter(m => m.s.c <= m.e.c);
  }

  if (file.formulas && file.formulas[sheetName]) {
    const oldF = file.formulas[sheetName];
    const newF = {};
    Object.keys(oldF).forEach(addr => {
      const rc = _addrToRC(addr);
      if (!rc) { newF[addr] = oldF[addr]; return; }
      if (rc.c >= at && rc.c < at + count) return; // 삭제됨
      const newC = rc.c >= at + count ? rc.c - count : rc.c;
      newF[_idxToColLetters(newC) + (rc.r + 1)] = shiftFormulaText(oldF[addr], -count, at, "insert");
    });
    file.formulas[sheetName] = newF;
  }

  if (file.styles && file.styles[sheetName]) {
    const styles = file.styles[sheetName];
    for (let r = 0; r < styles.length; r++) if (styles[r]) styles[r].splice(at, count);
  }
}

/* ===================================================================
   STATE
   =================================================================== */
const state = {
  inputs: [],       // [{ name, size, sheets, merges, styles, formulas, tables, originalFormulaValues }]
  inputsOriginal: [],
  output: null,
  outputOriginal: null,
  currentFileId: null,  // "input:NAME" or "output"
  currentSheet: null,
  selectedSheets: [],   // 현재 파일 안에서 다중 선택된 시트(기본=[currentSheet])
  pipeline: [],
  chatHistory: [],
  currentPage: "generator",
  editingStepId: null,

  // ver2.0
  fuzzyResolution: {},   // { "lookupKey": "actualKey" } 사용자가 한번 선택한 매핑 캐시
  lastError: null,       // { stepIdx, description, message, stack }
  formulaResults: {},    // { fileId: { sheetName: { "A1": evaluatedValue } } } 시뮬레이터용
};

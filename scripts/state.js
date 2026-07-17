/* ===================================================================
   STATE
   =================================================================== */
const state = {
  inputs: [],
  inputsOriginal: [],
  output: null,
  outputOriginal: null,
  outputTemplates: [],
  activeOutputIndex: -1,
  currentFileId: null,  // "input:NAME", "output", or "output:INDEX"
  currentSheet: null,
  selectedCell: null,   // { fileId, sheet, r, c }
  selectedRange: null,  // { fileId, sheet, r1, c1, r2, c2, type }
  selectedRanges: [],   // multiple explicit cell/range selections
  selectionAnchor: null,
  selectedSheets: [],
  pipeline: [],
  runnerMappingChecked: false,
  runnerMappingSignature: "",
  runnerMappings: {},
  runnerMappingRunActive: false,   // 실행 동안만 true — state.pipeline 매핑본 스왑 중 소스변경 오인 리셋 방지
  pipelineOriginalDuringRun: null, // 매핑본 스왑 중 '제네릭 이름 원본' — 저장(save-load)이 항상 이걸 쓴다(치환본 저장 방지)
  logicSaveBaseName: "",
  logicSaveInputSig: "",  // [A안] 위 이름이 나온 '입력 파일 세트' 서명 — 지금 입력이 다르면 그 이름을 기본값으로 안 씀
  history: { undo: [], redo: [], limit: 80 },
  chatHistory: [],
  currentPage: "generator",
  editingStepId: null,
  uploadJob: null,

  fuzzyResolution: {},
  lastError: null,
  formulaResults: {},
};

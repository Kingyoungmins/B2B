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
  history: { undo: [], redo: [], limit: 80 },
  chatHistory: [],
  currentPage: "generator",
  editingStepId: null,
  uploadJob: null,

  fuzzyResolution: {},
  lastError: null,
  formulaResults: {},
};

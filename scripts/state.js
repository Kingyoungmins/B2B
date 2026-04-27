/* ===================================================================
   STATE
   =================================================================== */
const state = {
  inputs: [],       // [{ name, size, sheets: {sheetName: aoa}, merges: {sheetName: merges} }]
  inputsOriginal: [],
  output: null,     // same shape OR null
  outputOriginal: null, // frozen copy of original output template
  currentFileId: null,  // "input:NAME" or "output"
  currentSheet: null,
  pipeline: [],     // [{ id, prompt, code, description, applied: bool }]
  chatHistory: [],  // for Claude context
  currentPage: "generator",
};

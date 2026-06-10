# Excel Mirror Architecture

## Goal

ver4.0 replaces the browser-rendered spreadsheet simulator with a real Excel-backed mirror on Windows.
Excel becomes the source of truth for workbook rendering, formulas, formatting, filtering, and large-file behavior.
The web app remains responsible for skill generation, execution controls, status, logs, and packaging.

See [PYTHON_ENGINE_RISKS.md](PYTHON_ENGINE_RISKS.md) for notes on why an openpyxl-first Python engine conflicts with this live Excel UX, especially on low-spec Windows PCs with one `EXCEL.EXE` holding multiple workbooks.

## Feasibility

This is feasible on Windows when Microsoft Excel is installed. The local Python backend can control Excel through COM automation and expose a small HTTP API to the web UI.

The single EXE can still be distributed as one file, but it cannot bundle Microsoft Excel itself. Target PCs must have desktop Excel installed.

## Proposed Runtime Model

- Upload workbook through the web UI.
- Backend writes it to a managed temp workspace.
- Backend opens the workbook in a real Excel process through COM.
- Web UI sends commands such as open workbook, activate sheet, select range, run step, save copy, close workbook.
- Pipeline execution writes directly into the Excel workbook, then asks Excel to recalculate and save.
- For previews, the UI can either show status/range metadata or request small snapshots from Excel. The primary view is the Excel window itself.

## Backend Responsibilities

- Own the Excel process lifecycle.
- Track opened workbooks by id.
- Prevent orphaned Excel processes when the browser or EXE closes.
- Serialize workbook operations so two commands do not mutate Excel at the same time.
- Save outputs to user-selected/result paths.
- Provide fallback errors when Excel is not installed or COM is unavailable.

## API Sketch

- `POST /api/excel/open`
  - body: `{ "workbookId": "..." }`
  - opens the uploaded workbook in Excel.

- `POST /api/excel/activate`
  - body: `{ "excelId": "...", "sheet": "...", "range": "B61:D63" }`
  - activates a sheet/range in Excel.

- `POST /api/excel/run-step`
  - body: `{ "excelId": "...", "stepId": "..." }`
  - runs one skill against the Excel-backed workbook state.

- `POST /api/excel/save-as`
  - body: `{ "excelId": "...", "name": "result.xlsx" }`
  - saves the current workbook and returns a download id.

- `POST /api/excel/close`
  - body: `{ "excelId": "..." }`
  - closes workbook and releases COM objects.

## Implementation Phases

1. Add Excel COM session manager in the Python backend.
2. Add open/close/health APIs and lifecycle cleanup.
3. Replace simulator panel with Excel mirror controls.
4. Route skill execution through Excel-backed workbook files.
5. Add save/download and error recovery around real Excel state.

## Risks

- Excel must be installed on the target PC.
- COM automation can hang if Excel shows modal dialogs. Startup should disable alerts where possible.
- Protected View, password-protected files, macro prompts, and external-link prompts need explicit handling.
- Multiple Excel instances and user-opened workbooks must be isolated carefully.

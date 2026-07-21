# Python Engine Risks for Live Excel UX

## Context

This note summarizes design risks if the current live Excel architecture moves toward a Python-based skill language.

Current target environment observed during testing:

- Windows 11 Enterprise, 64-bit
- Microsoft 365 Excel 64-bit
- Intel Xeon Gold 6338 virtual CPU, 2 cores / 4 logical processors, about 2.0 GHz
- 12 GB RAM, with about 3 GB free during active testing
- Small local disk headroom on the test Cloud PC
- One packaged app executable, with the app server/native host bundled for offline use
- Experimental runtime shape: one app-owned `EXCEL.EXE` process holding multiple open workbooks

The current product UX assumes:

- Users upload multiple input/output workbooks.
- The app keeps those workbooks available as live Excel workbooks.
- UI tabs switch between workbooks.
- Chat-generated logic modifies the workbook the user is working with.
- The user expects the visible Excel workbook to reflect changes immediately.

## Key Definitions

`Python COM`
: Python code controls the live `Excel.Application` through COM. The code operates on the same workbook objects that are visible in Excel.

`openpyxl`
: Python code edits `.xlsx` files directly without using Excel. It does not operate on the visible workbook object already opened by Excel.

`Live Excel UX`
: The actual Excel window is part of the user experience. The visible workbook is expected to be the source of truth for selection, sheet state, formulas, formatting, and immediate visual confirmation.

## Why openpyxl Is Structurally Risky Here

Using openpyxl as the primary engine creates two workbook states:

```text
Visible workbook in EXCEL.EXE
File workbook modified by openpyxl
```

Those are not the same object. If openpyxl edits a file while the user is looking at a live Excel workbook, the screen does not update by itself. The app then needs a replace/reload flow:

1. Save or generate a modified workbook file with openpyxl.
2. Close or detach the currently visible workbook.
3. Open the modified file again in Excel.
4. Reconnect the UI session to the new workbook.
5. Restore selected file tab, sheet, scroll position, selected cell/range, and visibility state.

That flow conflicts with the current goal of reducing flicker and keeping a single stable Excel process with multiple workbooks.

## Collision Points with Current Architecture

### 1. Visible State Can Diverge from File State

The user may see workbook A in Excel while openpyxl has already written a different version of workbook A to disk. This weakens user trust because a chat command may appear to have no effect until a reload occurs.

### 2. Reload Costs Can Offset openpyxl Speed

openpyxl can be faster than Excel COM for file-only operations, but the current UX would require Excel reload/replacement to show the result. On the observed low-spec Cloud PC, workbook open/close and foreground window stabilization are expensive operations.

The expensive part becomes:

```text
openpyxl edit + save
close visible workbook
open replacement workbook in Excel
position/show active workbook
restore UI state
```

This can erase much of the speed advantage.

### 3. File Locks and Working Copies Get More Complex

If Excel already has a workbook open, writing the same file path with openpyxl can fail or produce stale state. The app must use working copies and result copies. With multiple output workbooks, every file needs a clear mapping:

```text
fileId -> excelId -> workingCopyPath -> resultPath -> visible workbook
```

Any mismatch can cause the wrong workbook to be shown or downloaded.

### 4. Formula Calculation Is Not Equivalent

openpyxl preserves formulas as strings but does not run Excel's calculation engine. For this product, users care whether formulas calculate correctly after generated logic runs.

If openpyxl writes inputs that affect formulas, the app still needs Excel to calculate the visible workbook. That again pulls the flow back into Excel COM.

### 5. Excel Objects Are Not Fully Preserved

openpyxl is good for many values, formulas, styles, merged cells, dimensions, and sheet properties. It is weaker or unsafe for objects such as charts, images, pivot tables, slicers, macros, and some workbook-level features.

The current customer feedback includes preservation concerns around formulas, hidden columns, merged cells, and downloaded files. Object loss or reload-based drift would be hard to explain to users.

### 6. UI Tab Switching Becomes Harder

The current single-Excel experiment keeps multiple workbooks open in one app-owned `EXCEL.EXE`. UI tabs can switch by activating one workbook and hiding the others.

If openpyxl produces replacement files, a tab switch may need to decide whether the visible workbook is stale and whether it should reload. This adds latency and can reintroduce flicker.

### 7. Multi-Workbook References Become Fragile

The app often needs input workbook values and output workbook writes in the same task. With live Excel COM, those workbooks can coexist in one Excel application. With openpyxl, cross-workbook state is file-based and may not match the live visible copies unless every copy is synchronized.

## Python COM Is a Better Fit Than openpyxl for This UX

If Python becomes the generated language, Python COM fits the current live architecture better:

```text
excelId -> session workbook COM object -> Python logic -> visible Excel updates
```

Benefits:

- The visible workbook is the modified workbook.
- Excel formulas can recalculate through Excel itself.
- Hidden columns, merged cells, sheet visibility, and workbook UI state stay in Excel's domain.
- Multiple workbooks can remain open in one app-owned `EXCEL.EXE`.
- UI tabs can continue switching by workbook activation rather than file replacement.

## Python COM Performance Rules

Python COM can be slow if generated code uses per-cell COM calls:

```python
for r in range(1, 10000):
    ws.Cells(r, 1).Value = data[r]
```

That pattern sends thousands of COM calls and is risky on the observed 2-core / 4-thread Cloud PC.

The generated Python style should be:

```python
values = ws.Range("A2:D10000").Value

# Process in Python memory.
result = []
for row in values:
    result.append([row[0], row[3] or 0])

ws.Range(f"G2:H{len(result) + 1}").Value = result
```

Rules to enforce:

- Avoid cell-by-cell COM loops.
- Read and write with `Range.Value` in bulk.
- Process data in Python memory.
- Write only the target contiguous ranges.
- Preserve formula cells by not overwriting formula-containing ranges.
- Avoid `ActiveWorkbook` and `ActiveSheet` unless the session explicitly sets them immediately before execution.
- Always restore Excel app settings in `finally`.

## Recommended Direction

For the current product shape, Python should not mean "openpyxl-first" if the live Excel UX remains central.

Recommended split:

- Primary generated Python engine: Python COM against the current `excelId` workbook.
- Optional helper path: openpyxl only for background file-only transformations where live preview is not required.
- Automatic fallback or warning when an openpyxl operation would require replacing a visible workbook.

In short:

```text
Live Excel UX + one EXCEL.EXE + N visible/available workbooks
=> Python COM is structurally aligned.

openpyxl-first
=> faster file editing, but risks visible/file state divergence and reload flicker.
```

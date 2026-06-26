/* ===================================================================
   TABLE DETECTION
   ===================================================================
   한 시트 안에 표가 여러 개 있을 수 있다. 빈 행/열로 분리된 사각
   영역을 찾아 표 후보로 제시한다.

   반환: [{ startRow, endRow, startCol, endCol, label, headerRow }]

   라벨 추정:
     - 표의 시작 행 위쪽으로 1~3행 이내에 단독 텍스트 셀이 있으면
       그 텍스트를 라벨로 사용
     - 그 외에는 헤더 행의 첫 비어있지 않은 셀 또는 좌표를 사용
   =================================================================== */

function _isEmptyCell(v) {
  return v === "" || v === null || v === undefined;
}

function _isRowEmpty(row) {
  if (!row) return true;
  for (let i = 0; i < row.length; i++) if (!_isEmptyCell(row[i])) return false;
  return true;
}

function _isColEmpty(aoa, c, r1, r2) {
  for (let r = r1; r <= r2; r++) {
    if (aoa[r] && !_isEmptyCell(aoa[r][c])) return false;
  }
  return true;
}

function detectTables(aoa) {
  if (!aoa || aoa.length === 0) return [];
  const tables = [];
  const rowCount = aoa.length;
  // 1단계: 빈 행으로 가로 밴드 분리
  const bands = [];
  let bandStart = -1;
  for (let r = 0; r < rowCount; r++) {
    const empty = _isRowEmpty(aoa[r]);
    if (!empty && bandStart < 0) bandStart = r;
    if (empty && bandStart >= 0) {
      bands.push({ startRow: bandStart, endRow: r - 1 });
      bandStart = -1;
    }
  }
  if (bandStart >= 0) bands.push({ startRow: bandStart, endRow: rowCount - 1 });

  // 2단계: 각 밴드 안에서 빈 열로 세로 분할
  bands.forEach(band => {
    let maxCols = 0;
    for (let r = band.startRow; r <= band.endRow; r++) {
      const len = aoa[r] ? aoa[r].length : 0;
      if (len > maxCols) maxCols = len;
    }
    if (maxCols === 0) return;
    let segStart = -1;
    for (let c = 0; c < maxCols; c++) {
      const empty = _isColEmpty(aoa, c, band.startRow, band.endRow);
      if (!empty && segStart < 0) segStart = c;
      if (empty && segStart >= 0) {
        tables.push({
          startRow: band.startRow,
          endRow: band.endRow,
          startCol: segStart,
          endCol: c - 1,
        });
        segStart = -1;
      }
    }
    if (segStart >= 0) {
      tables.push({
        startRow: band.startRow,
        endRow: band.endRow,
        startCol: segStart,
        endCol: maxCols - 1,
      });
    }
  });

  // 3단계: 너무 작은 영역(1x1, 1xN의 단일 라벨 등)은 거르고 라벨/헤더 추정
  const result = tables
    .filter(t => (t.endRow - t.startRow + 1) >= 2 || (t.endCol - t.startCol + 1) >= 2)
    .map(t => annotateTable(aoa, t));

  return result;
}

function annotateTable(aoa, t) {
  // 라벨: 표 위 1~3행 안에 단독 텍스트 셀
  let label = "";
  for (let r = Math.max(0, t.startRow - 3); r < t.startRow; r++) {
    const row = aoa[r] || [];
    for (let c = t.startCol; c <= Math.min(t.endCol, t.startCol + 3); c++) {
      const v = row[c];
      if (!_isEmptyCell(v) && typeof v === "string" && String(v).trim().length >= 1 && String(v).trim().length <= 30) {
        label = String(v).trim();
        break;
      }
    }
    if (label) break;
  }
  // 헤더: 표 안의 첫 비어있지 않은 행
  let headerRow = t.startRow;
  for (let r = t.startRow; r <= t.endRow; r++) {
    const row = aoa[r] || [];
    let nonEmpty = 0;
    for (let c = t.startCol; c <= t.endCol; c++) if (!_isEmptyCell(row[c])) nonEmpty++;
    if (nonEmpty >= 2) { headerRow = r; break; }
  }
  if (!label) {
    // 헤더 행의 첫 비어있지 않은 셀로 라벨 대체
    const row = aoa[headerRow] || [];
    for (let c = t.startCol; c <= t.endCol; c++) {
      if (!_isEmptyCell(row[c])) { label = String(row[c]).trim().slice(0, 30); break; }
    }
  }
  if (!label) label = `(${rangeRef(t)})`;
  return { ...t, label, headerRow, range: rangeRef(t) };
}

function rangeRef(t) {
  return colLetters(t.startCol) + (t.startRow + 1) + ":" + colLetters(t.endCol) + (t.endRow + 1);
}
function colLetters(n) {
  let s = ""; n++;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// 라벨이 같은 표가 여러 개일 때, 사용자가 "첫 번째 표" 등으로 모호하게 지칭한 경우
// 후보들을 추려준다.
function findTablesByLabel(tables, label) {
  if (!tables || !label) return [];
  return tables.filter(t => similarity(t.label, label) >= 0.7);
}

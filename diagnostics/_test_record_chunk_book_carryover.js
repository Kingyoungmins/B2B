// [회귀] 분할 조각의 '활성 워크북 캐리오버' — 무자격 Sheets("X").Select 로 시작하는 조각은
// 앞 조각이 남긴 활성 워크북을 상속해야 한다(전역 앵커 폴백 X).
// 실측(2026-07-29, input_v056_청구내역_4단계 zip): 3단계에서 "시트를 못 찾음(subscript out of
// range)" 반복. 원인 — Step2 가 '정산서'에 새 시트 asd 를 만들고, Step3/4 는 무자격
// Sheets("asd").Select 로 시작하는데, 분할이 이들을 앵커(녹화 시작 파일=청구내역)에 배정해
// 재생 시 청구내역에서 asd 를 찾다 실패. 라이브 녹화 땐 활성 워크북이 정산서라 됐음.
// 수정: pipeline.js record-stop 의 _chunkBooks 캐리오버 —
//   시작북 = 첫 동작 Activate 북 or 앞 조각 끝 활성 북(앵커에서 출발)
//   끝 활성 북 = 조각 안 마지막 Activate or 시작북.
// 실행: node diagnostics/_test_record_chunk_book_carryover.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8");

let pass = 0, fail = 0;
const t = (n, c) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n); } };

// 소스에서 arrow-const 함수 본문을 중괄호 매칭으로 추출해 '실제' 함수를 실행한다.
function extractArrow(str, name) {
  const sig = "const " + name + " = (code) => {";
  const start = str.indexOf(sig);
  if (start < 0) throw new Error("not found: " + name);
  const open = str.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") { depth--; if (depth === 0) return str.slice(start + ("const " + name + " = ").length, i + 1); }
  }
  throw new Error("unbalanced: " + name);
}
const _chunkPrimaryBook = eval("(" + extractArrow(src, "_chunkPrimaryBook") + ")");
const _chunkLastActivateBook = eval("(" + extractArrow(src, "_chunkLastActivateBook") + ")");

// ── 실제 zip(input_v056_청구내역_4단계)의 조각 코드 ──
const S1 = 'Sub B2BSkill()\n    Workbooks("input_v056_청구내역.xlsx").Activate\n    Range("A1:H13").Copy\nWorkbooks("input_v056_청구내역.xlsx").Activate\n    Range("J1").Select\n    ActiveSheet.Paste\nWindows("input_v056_정산서.xlsx").Activate\n    Range("A1").Select\n    ActiveSheet.Paste\nEnd Sub\n';
const S2 = 'Sub B2BSkill()\n    Windows("input_v056_정산서.xlsx").Activate\n    Sheets.Add After:=ActiveSheet\n    B2B_NewSheet1 = ActiveSheet.Name\n    Sheets(B2B_NewSheet1).Select\n    Sheets(B2B_NewSheet1).Name = "asd"\nEnd Sub\n';
const S3 = 'Sub B2BSkill()\n    Sheets("asd").Select\n    Range("A1").Select\n    Application.CutCopyMode = False\n    ActiveCell.FormulaR1C1 = "123"\nEnd Sub\n';
const S4 = 'Sub B2BSkill()\n    Sheets("asd").Select\n    Range("B1").Select\n    ActiveCell.FormulaR1C1 = "213"\nEnd Sub\n';
const CG = "input_v056_청구내역.xlsx", JS = "input_v056_정산서.xlsx";

// ── 1. 실제 헬퍼가 lead/last Activate 를 바르게 뽑는가 ──
t("1a S1 lead = 청구내역(첫 동작)", _chunkPrimaryBook(S1) === CG);
t("1b S1 last Activate = 정산서(마지막)", _chunkLastActivateBook(S1) === JS);
t("1c S2 lead = 정산서", _chunkPrimaryBook(S2) === JS);
t("1d S3 lead = ''(무자격 Sheets().Select 로 시작)", _chunkPrimaryBook(S3) === "");
t("1e S3 last Activate = ''(Activate 없음)", _chunkLastActivateBook(S3) === "");
t("1f S4 lead = '' / last = ''", _chunkPrimaryBook(S4) === "" && _chunkLastActivateBook(S4) === "");

// ── 2. 캐리오버 로직(소스와 동일)으로 조각별 시작 워크북 계산 ──
// 이름→fileId 스텁(envConfig: 청구내역/정산서 두 입력).
const fileIdByBook = (b) => (b === CG ? "input:" + CG : b === JS ? "input:" + JS : null);
function carryover(chunks, anchorBook, targetFileId) {
  const books = [];
  let runningBook = String(anchorBook || "");
  for (const code of chunks) {
    const leadBook = _chunkPrimaryBook(code);
    const startBook = leadBook || runningBook;
    const startFileId = startBook ? (fileIdByBook(startBook) || null) : null;
    books.push({ startFileId: startFileId || targetFileId, startBook });
    const lastBook = _chunkLastActivateBook(code);
    runningBook = lastBook || startBook;
  }
  return books;
}
const anchor = CG;                       // data.recordedWorkbook = 녹화 시작 파일(청구내역)
const targetFileId = "input:" + CG;      // 앵커 fileId
const books = carryover([S1, S2, S3, S4], anchor, targetFileId);

t("2a Step1 → 청구내역(앵커)", books[0].startFileId === "input:" + CG);
t("2b Step2 → 정산서(첫 동작 Activate)", books[1].startFileId === "input:" + JS);
t("2c Step3 → 정산서(앞 조각 활성 상속) ★버그였던 지점", books[2].startFileId === "input:" + JS);
t("2d Step4 → 정산서(상속 유지) ★버그였던 지점", books[3].startFileId === "input:" + JS);
// 회귀 방지: 3/4 가 다시 청구내역(앵커)으로 새면 실패
t("2e Step3/4 가 앵커(청구내역)로 폴백하지 않음",
  books[2].startFileId !== "input:" + CG && books[3].startFileId !== "input:" + CG);
// recordedWorkbook 스탬프(startBook)도 정산서로 상속
t("2f Step3 recordedWorkbook 스탬프 = 정산서", books[2].startBook === JS);

// ── 3. 소스 배선: _chunkBooks 캐리오버가 makeStep 에 실제로 연결됐는가 ──
t("3a _chunkBooks 실행순서 캐리오버 루프 존재",
  /const _chunkBooks = \[\];/.test(src)
  && /const startBook = leadBook \|\| runningBook;/.test(src)
  && /runningBook = lastBook \|\| startBook;/.test(src));
t("3b makeStep 이 _chunkBooks\\[_idx\\] 사용(앵커 폴백 아님)",
  /const _bk = _chunkBooks\[_idx\] \|\| \{\};/.test(src)
  && /const _stepFileId = _bk\.startFileId \|\| targetFileId;/.test(src));
t("3c 매핑이 인덱스 전달(makeStep(s, i))",
  /picked\.map\(\(s, i\) => makeStep\(s, i\)\)/.test(src));

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);

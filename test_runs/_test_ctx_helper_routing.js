// [사용자 지시] 시트 복사/복사후 이름변경/추가/삭제·단순 정렬처럼 ctx 헬퍼가 결정적인 작업은
// VBA 가 아니라 Python(ctx) 으로 라우팅. 헬퍼 없는 복합/매칭 작업은 안정성 위해 VBA 유지.
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const s = src.indexOf("function userExplicitlyRequestsVba");
const after = src.indexOf("function numericArithmeticIntent", s + 10);
let block = src.slice(s, after);
block += "\nglobalThis.R = { vba: shouldRouteRequestToVba, py: shouldRouteRequestToPython, sheet: sheetOpIntent, sort: ctxSortIntent };";
eval(block);
const R = globalThis.R;

let pass = 0, fail = 0;
const ck = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

// 같은 파일 시트 복사/복사후 이름변경/추가/삭제·정렬 → Python (VBA 아님)
const tests = [
  ["이 시트 복사해줘", true],
  ["Sheet1 시트를 복사해서 이름 바꿔줘", true],
  ["이 시트 복사해서 이름 요약본으로 바꿔줘", true],
  ["청구금액 시트 삭제해줘", true],
  ["시트 이름 바꿔줘", true],
  ["새 시트 추가해줘", true],
  ["A열 기준으로 오름차순 정렬해줘", true],
];
for (const [m, py] of tests) {
  ck(`'${m}' → Python`, R.py(m) === py && R.vba(m) === false);
}

// [2026-06-23 갱신] 교차파일 시트복사도 Python(ctx.copy_sheet/dst_book)으로 보낸다.
// VBA 는 Workbooks() 정확매칭이라 모델의 파일명 공백삽입을 못 견딤 → ctx.book 정규화 매칭이 해결.
const crossPhrase = "@시트[a.xlsx/Sheet1] 시트 전체를 다른 파일로 복사해줘";
ck("[교차파일] 다른 파일로 시트복사 → Python", R.py(crossPhrase) === true && R.vba(crossPhrase) === false);
const crossTwoFiles = "@시트[a.xlsx/Sheet1] 를 @파일[b.xlsx] 로 복사해줘";
ck("[교차파일] 두 파일 멘션 시트복사 → Python", R.py(crossTwoFiles) === true);
// 신고 케이스: '시트복사해서 @파일[...]에 추가' (대상 1파일 멘션) → Python
ck("[신고] 시트복사해서 @파일[x]에 추가 → Python", R.py("시트복사해서 @파일[input)_기업DW추출_x.xlsx] 에 추가해줘") === true);
ck("[교차파일] 출력 파일 시트 이름변경 → Python", R.py("출력 파일의 시트 이름 바꿔줘") === true);

// [신고] 월 정보 +1 (월/날짜 증감) → Python (ctx.shift_months)
const monthShift = "선택 범위: @범위[KB카드_x_26년06월_x.xlsx/2026년!B336:D336] 월 정보를 +1 해줘";
ck("[월증감] '월 정보 +1' → Python", R.py(monthShift) === true && R.vba(monthShift) === false);
ck("[월증감] '다음달로 변경' → Python", R.py("이 셀 날짜를 다음달로 변경해줘") === true);

// 헬퍼로 안 풀리는 복합/매칭 작업은 시트/정렬 단어가 있어도 Python 강제 안 함(기존 라우팅 유지)
ck("[제외] '시트 복사 후 가입번호 매칭해서 합산' → sheetOp FALSE", R.sheet("시트 복사 후 가입번호 매칭해서 합산") === false);
ck("[제외] '매칭해서 정렬' → ctxSort FALSE", R.sort("가입번호 매칭해서 정렬해줘") === false);
ck("[제외] '피벗으로 집계' 시트단어 없음 → sheetOp FALSE", R.sheet("지점별 매출 피벗으로 집계") === false);
// 'A열 데이터 삭제'는 시트삭제가 아니라 내용삭제 — sheetOp 로 오인 안 함
ck("[경계] '시트의 데이터 삭제' → sheetOp FALSE(내용삭제)", R.sheet("시트의 데이터 삭제해줘") === false);

console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
process.exit(fail ? 2 : 0);

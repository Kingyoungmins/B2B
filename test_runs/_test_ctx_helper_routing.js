// [사용자 지시] 시트 복사/복사후 이름변경/추가/삭제·단순 정렬처럼 ctx 헬퍼가 결정적인 작업은
// VBA 가 아니라 Python(ctx) 으로 라우팅. 헬퍼 없는 복합/매칭 작업은 안정성 위해 VBA 유지.
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const s = src.indexOf("function userExplicitlyRequestsVba");
const after = src.indexOf("function numericArithmeticIntent", s + 10);
let block = src.slice(s, after);
block += "\nglobalThis.R = { vba: shouldRouteRequestToVba, py: shouldRouteRequestToPython, sheet: sheetOpIntent, sort: ctxSortIntent, rangeCalc: simpleRangeArithmeticIntent, pivot: pivotIntent, append: appendSameFormatSheetsIntent, valWrite: simpleValueWriteIntent, colMove: columnMoveIntent, copyClear: columnCopyClearIntent, swap: columnSwapIntent, copyVals: copyValuesIntent, colCopy: columnCopyIntent, clearData: clearDataIntent, fillSum: fillSumColIntent };";
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

// [신고] 피벗/크로스탭 → Python (ctx.pivot 1D/2D)
const crosstab = "행은 지점, 열은 월로, 값은 매출 합계인 피벗표 만들어줘";
ck("[피벗] 2D 크로스탭 → Python", R.py(crosstab) === true && R.vba(crosstab) === false);
ck("[피벗] '회사별 매출 합계' 1D → Python", R.py("회사별 매출 합계 요약해줘") === true);
ck("[피벗] pivotIntent 감지", R.pivot(crosstab) === true && R.pivot("회사별 매출 합계 요약") === true);
// 매칭/덮어쓰기는 피벗 아님 → VBA 유지(오인 금지)
ck("[제외] 가입번호 매칭 행 덮어쓰기 → pivot FALSE", R.pivot("가입번호가 일치하는 행의 금액을 덮어써줘") === false);

// 헬퍼로 안 풀리는 복합/매칭 작업은 시트/정렬 단어가 있어도 Python 강제 안 함(기존 라우팅 유지)
ck("[제외] '시트 복사 후 가입번호 매칭해서 합산' → sheetOp FALSE", R.sheet("시트 복사 후 가입번호 매칭해서 합산") === false);
ck("[제외] '매칭해서 정렬' → ctxSort FALSE", R.sort("가입번호 매칭해서 정렬해줘") === false);
ck("[제외] '피벗으로 집계' 시트단어 없음 → sheetOp FALSE", R.sheet("지점별 매출 피벗으로 집계") === false);
// 'A열 데이터 삭제'는 시트삭제가 아니라 내용삭제 — sheetOp 로 오인 안 함
ck("[경계] '시트의 데이터 삭제' → sheetOp FALSE(내용삭제)", R.sheet("시트의 데이터 삭제해줘") === false);

// [2026-06-23] 같은 시트의 E6:E16 값을 산술 계산해 D6:D16에 쓰는 단순 요청은 Python ctx.
// VBA 모델이 "Network 이용현황(26년4월)"을 "Network 이용현황 (26 년 4 월)"로 바꾸던 회귀를 피한다.
const simpleRangeCalc = "\uc120\ud0dd \ubc94\uc704: @\ubc94\uc704[\uc5d4\uc528 \uc790\ub8cc_IDC_26\ub1443\uc6d4 \uc0ac\uc6a9\ub0b4\uc5ed_26\ub1444\uc6d4\uccad\uad6c\ubd84\uc2e0\uaddc\uc13c\ud130 2.xlsx/Network \uc774\uc6a9\ud604\ud669(26\ub1444\uc6d4)!E6:E16] \ub370\uc774\ud130\uac12\uc744 1000000\uc73c\ub85c \ub098\ub208\uac12\uc744 \uc120\ud0dd \ubc94\uc704: @\ubc94\uc704[\uc5d4\uc528 \uc790\ub8cc_IDC_26\ub1443\uc6d4 \uc0ac\uc6a9\ub0b4\uc5ed_26\ub1444\uc6d4\uccad\uad6c\ubd84\uc2e0\uaddc\uc13c\ud130 2.xlsx/Network \uc774\uc6a9\ud604\ud669(26\ub1444\uc6d4)!D6:D16]\uc5ec\uae30\uc5d0 \uc785\ub825\ud574\uc918";
ck("[range-calc] E6:E16 / 1000000 -> D6:D16 simpleRangeArithmetic TRUE", R.rangeCalc(simpleRangeCalc) === true);
ck("[range-calc] E6:E16 / 1000000 -> D6:D16 routePython TRUE", R.py(simpleRangeCalc) === true && R.vba(simpleRangeCalc) === false);

// [2026-06-24] 동일 포맷 여러 파일 표 통합은 Python ctx.append_same_format_sheets 헬퍼로 라우팅한다.
const appendSameFormat = "5개 입력 파일에 동일한 포맷의 표가 있고 가입자별청구내역 하나의 헤더만 남기고 헤더 아래값을 연결하여 출력 파일의 새 시트에 하나의 표로 만들어줘";
ck("[append] same-format multi-file append intent TRUE", R.append(appendSameFormat) === true);
ck("[append] same-format multi-file append -> Python", R.py(appendSameFormat) === true && R.vba(appendSameFormat) === false);

// [0.5.17] 단순 값 채우기(계산·매칭·조건 없음) → Python ctx.write. '기본엔진 VBA 로 새던' 케이스 수정.
ck("[값쓰기] 'H열에 0을 채워줘' → Python", R.py("H열에 0을 채워줘") === true && R.vba("H열에 0을 채워줘") === false);
ck("[값쓰기] 'J5에 100 넣어줘' → Python", R.py("J5에 100 넣어줘") === true && R.vba("J5에 100 넣어줘") === false);
ck("[값쓰기] '이 셀에 완료라고 입력해줘' → Python", R.py("이 셀에 완료라고 입력해줘") === true);
ck("[값쓰기] intent 감지", R.valWrite("H열에 0을 채워줘") === true);
// 복합/매칭/조건/집계/삭제는 값쓰기로 오인하지 말 것 → 기존 경로(VBA) 유지(회귀 방지)
ck("[제외] '가입번호 일치 행 채워' → 값쓰기 FALSE", R.valWrite("가입번호 일치하는 행에 값 채워줘") === false);
ck("[제외] 키매칭 행 갱신 → VBA 유지", R.vba("가입번호가 일치하는 행 전체의 금액을 채워 갱신해줘") === true);
ck("[제외] 'F열 합계를 J5에 채워' → 값쓰기 FALSE(집계)", R.valWrite("F열 합계를 J5에 채워줘") === false);
ck("[제외] 'F열 100만 미만 행 삭제' → 값쓰기 FALSE", R.valWrite("F열이 100만원 미만이면 행 삭제해줘") === false);
ck("[제외] 대상신호 없는 '값 채워' → 값쓰기 FALSE(오탐방지)", R.valWrite("값 채워줘") === false);

// [0.5.17] 시트 이름변경 감지 강화 — '이름/명' 없이 자연스럽게 말해도, 긴 새 이름이어도 Python(ctx)
ck("[시트명] '이 시트를 3월로 바꿔줘' → Python", R.py("이 시트를 3월로 바꿔줘") === true && R.vba("이 시트를 3월로 바꿔줘") === false);
ck("[시트명] 'Sheet1을 요약으로 바꿔줘' → Python", R.py("Sheet1을 요약으로 바꿔줘") === true);
ck("[시트명] '시트 이름을 2026년 5월로 변경' → Python", R.py("시트 이름을 2026년 5월로 변경") === true);
ck("[시트명] '시트명을 2026으로 변경해줘' → Python", R.py("시트명을 2026으로 변경해줘") === true);
ck("[시트명] '@시트[a.xlsx/Sheet1] 을 3월로 바꿔줘' → Python", R.py("@시트[a.xlsx/Sheet1] 을 3월로 바꿔줘") === true);
// 내용/서식 변경은 시트이름변경으로 오인 금지(기존 경로 유지)
ck("[제외] '시트의 데이터를 3월로 바꿔' → sheetOp FALSE", R.sheet("시트의 데이터를 3월로 바꿔줘") === false);
ck("[제외] '시트 색을 빨강으로 바꿔' → sheetOp FALSE", R.sheet("이 시트 색을 빨강으로 바꿔줘") === false);

// [0.5.17] 열(컬럼) 이동/재배치/맞바꾸기 → Python(ctx.move_cols, 병합 안전). VBA 병합 1004 회피.
ck("[열이동] 'D열을 G열 앞으로 옮겨줘' → Python", R.py("D열을 G열 앞으로 옮겨줘") === true && R.vba("D열을 G열 앞으로 옮겨줘") === false);
ck("[열이동] '금액 열을 합계 앞으로 이동' → Python", R.py("금액 열을 합계 앞으로 이동해줘") === true);
ck("[열이동] '열 순서를 바꿔줘' → Python", R.py("열 순서를 바꿔줘") === true);
ck("[열이동] 'D열과 E열 맞바꿔줘' → Python", R.py("D열과 E열 맞바꿔줘") === true);
ck("[열이동] intent 감지", R.colMove("D열을 G열 앞으로 옮겨줘") === true);
// 매칭/집계는 열이동으로 오인 금지(기존 경로 유지)
ck("[제외] '일치 열을 앞으로 옮겨' → colMove FALSE(매칭)", R.colMove("가입번호 일치하는 열을 앞으로 옮겨줘") === false);
ck("[제외] '매출 열 지점별 집계' → colMove FALSE", R.colMove("매출 열을 지점별로 옮겨 집계해줘") === false);

// [0.5.18] "X열을 Y로 이동/복사하고 원래 X열은 비우기" → copy+clear(원본 삭제/move 아님). eval 파손 케이스 방어.
const cc = "요약 시트에서 D열을 G열로 이동하고 원래 D열은 비우세요";
ck("[copy+clear] '이동+원본 비우기' → Python", R.py(cc) === true && R.vba(cc) === false);
ck("[copy+clear] copyClear intent 감지", R.copyClear(cc) === true);
ck("[copy+clear] 이 변형은 move_cols 아님(colMove FALSE)", R.colMove(cc) === false);
ck("[copy+clear] '값 복사 후 원본 지워' 도 감지", R.copyClear("D열을 G열로 복사하고 원본은 지워줘") === true);
// 순수 이동(원본 비우기 언급 없음)은 여전히 move_cols
ck("[구분] '원본 비우기' 없는 순수 이동 → colMove TRUE, copyClear FALSE",
   R.colMove("D열을 G열 앞으로 옮겨줘") === true && R.copyClear("D열을 G열 앞으로 옮겨줘") === false);

// [0.5.18] eval 3/4/5 라우팅 — 값복사(copy_values) / 열복사(copy_col) / 열맞바꿈(swap_cols)
// eval5: 두 열 맞바꿈 → swap (move_cols 아님)
ck("[swap] 'D열과 E열 위치를 서로 맞바꿔' → Python", R.py("D열과 E열의 위치를 서로 맞바꿔줘") === true);
ck("[swap] swap intent 감지", R.swap("D열과 E열의 위치를 서로 맞바꿔줘") === true);
ck("[swap] 맞바꿈은 move_cols 아님(colMove FALSE)", R.colMove("D열과 E열의 위치를 서로 맞바꿔줘") === false);
// eval3: 원문 텍스트/값 그대로 복사 → copy_values
ck("[copyVals] 'A2 제목 텍스트를 J2로 원문 그대로 복사' → Python", R.py("A2 제목 텍스트를 J2로 원문 그대로 복사") === true);
ck("[copyVals] copyValues intent 감지", R.copyVals("A2 제목 텍스트를 J2로 원문 그대로 복사") === true);
ck("[copyVals] 'D:F 계산 결과 값을 J:L에 값으로 복사' 감지", R.copyVals("D:F 계산 결과 값을 J:L에 값으로 복사") === true);
// eval4: 열→열 서식째 복사 → copy_col (값복사/맞바꿈/원본비우기 아님)
ck("[colCopy] 'E열을 L열로 복사(서식 보존)' → Python", R.py("E열 날짜 값을 L열로 복사하고 서식을 보존") === true);
ck("[colCopy] columnCopy intent 감지", R.colCopy("E열을 L열로 복사해줘") === true);
// eval1: '범위 복사(수식/서식 보존)'는 새 인텐트에 안 걸리고 기본 ctx.copy 경로 유지(회귀 방지)
ck("[유지] 'A4:H28 범위를 J4로 복사' → copyVals/colCopy FALSE", R.copyVals("A4:H28 범위를 J4:Q28에 수식 서식 보존해 복사") === false && R.colCopy("A4:H28 범위를 J4:Q28에 수식 서식 보존해 복사") === false);

// [0.5.18] eval: 데이터만 비우기(clear) / 합계열 그룹 SUM(fill_sum_col)
ck("[clear] '요약 B열 데이터만 비우고' → Python", R.py("요약 시트 B열 데이터만 비우고 예전 작업은 반복하지 마") === true);
ck("[clear] clearData intent 감지", R.clearData("요약 시트 B열 데이터만 비우고") === true);
ck("[clear] '시트 데이터 삭제'(내용지우기)도 감지", R.clearData("이 열 내용을 지워줘") === true);
ck("[제외] '행 삭제'는 clearData 아님", R.clearData("F열이 100만 미만인 행을 삭제해줘") === false);
ck("[fillSum] 'F열에 D+E 합계 수식 채워' → Python", R.py("요약 F열에 D+E 합계 수식을 다시 채워") === true);
ck("[fillSum] fillSumCol intent 감지", R.fillSum("F열(합계)에 각 행 D+E 수식을 채워") === true);
ck("[제외] '합계 행 추가'는 fillSumCol 아님(열 아님)", R.fillSum("맨 아래 합계 행 추가해줘") === false);

console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
process.exit(fail ? 2 : 0);

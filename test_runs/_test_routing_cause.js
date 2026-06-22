// 라우팅 패치 검증: @멘션(파일명/시트명) 키워드 충돌 제거 후 동작 + 회귀.
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const s = src.indexOf("function userExplicitlyRequestsVba");
const pIdx = src.indexOf("function shouldRouteRequestToPython");
const after = src.indexOf("function numericArithmeticIntent", pIdx + 10);
let block = src.slice(s, after);
block += "\nglobalThis.R = { vba: shouldRouteRequestToVba, py: shouldRouteRequestToPython, simple: shouldRouteSimpleStructureEditToPython };";
eval(block);
const R = globalThis.R;

let pass = 0, fail = 0;
const check = (n, c) => { (c ? pass++ : fail++); console.log((c ? " OK  " : "FAIL ") + n); };

// 1) 신고된 케이스: 파일명에 'LG작성' → 이제 Python COM 으로 라우팅돼야 함(수정 핵심)
const reported = '선택 범위: @범위[output_HCN대사용_영총.사지.LG유플러스 정산내역_2026년03월_LG작성.xlsx/SO사업자별요금!H90:H104] 셀 삭제';
check("[수정] 신고 케이스 simple→Python TRUE", R.simple(reported) === true);
check("[수정] 신고 케이스 routeVba FALSE", R.vba(reported) === false);
check("[수정] 신고 케이스 routePython TRUE", R.py(reported) === true);

// 2) 파일명에 '복사본' 들어간 단순 삭제도 Python (키워드 충돌 일반 해결)
const copyName = '@범위[output_복사본_정산.xlsx/Sheet1!A1:A10] 셀 삭제';
check("파일명 '복사본'+단순삭제 → simple TRUE", R.simple(copyName) === true);
check("파일명 '복사본'+단순삭제 → routeVba FALSE", R.vba(copyName) === false);

// 3) 회귀: 진짜 피벗/집계 요청은 여전히 VBA
const pivot = '@범위[input.xlsx/매출!A1:D100] 지점별 매출 합계를 피벗으로 만들어줘';
check("[회귀] 피벗 요청 → routeVba TRUE", R.vba(pivot) === true);

// 4) 회귀: 시트 전체 교차파일 복사는 여전히 VBA
const crossCopy = '@시트[a.xlsx/Sheet1] 시트 전체를 다른 파일로 복사해줘';
check("[회귀] 시트전체 교차파일 복사 → routeVba TRUE", R.vba(crossCopy) === true);

// 5) 회귀: 명시적 VBA 요청은 VBA
check("[회귀] 'vba로 ... 지워줘' → routeVba TRUE", R.vba('vba로 @범위[a.xlsx/S!A1:A5] 지워줘') === true);

// 6) 회귀: 멘션 없는 '선택 범위 셀 삭제' → Python
check("[회귀] '선택 범위 셀 삭제' → simple TRUE", R.simple('선택 범위 셀 삭제') === true);

// 7) 회귀: 단순 삭제가 아니어도(매칭+합산) 파일명 무관하게 VBA/복합 라우팅 유지
const complex = '@범위[a.xlsx/S!A1:A100] 가입번호가 일치하는 행의 금액을 합산해서 @범위[b.xlsx/S!H:H] 에 작성';
check("[회귀] 매칭+합산 복합요청은 simple FALSE", R.simple(complex) === false);
check("[회귀] 매칭+합산 복합요청은 routePython FALSE", R.py(complex) === false);

// 8) regression: conditional duplicate row deletion must go to VBA, not Python COM.
const duplicateDelete = "\u0045\uc5f4 \u004d\u0056\u004e\u004f\uc0c1\ud488\uba85\uc5d0\uc11c '\uc548\uc804\uc81c\uc77c'\ub9cc \u0054\uc5f4 '\u0045\u0049\u0044' \uc911\ubcf5\uac12\uc81c\uac70\ud574. \uc911\ubcf5\uac12 \uc81c\uac70\ud560\ub54c \ubc29\ubc95\uc740 \uc704\uc5d0 \uc788\ub294 \uac12\ubd80\ud130 \uc9c0\uc6cc. \ub300\uc2e0 \uc218\ub0a9\uae08\uc561\uc774 1 \uc774\uc0c1\uc778\uac70\ub294 \uc9c0\uc6b0\uba74 \uc548\ub3fc";
check("[regression] conditional duplicate row delete -> routeVba TRUE", R.vba(duplicateDelete) === true);
check("[regression] conditional duplicate row delete -> routePython FALSE", R.py(duplicateDelete) === false);
check("[regression] conditional duplicate row delete -> simple FALSE", R.simple(duplicateDelete) === false);

console.log("\n=== RESULT: " + pass + " PASS / " + fail + " FAIL ===");
process.exit(fail ? 2 : 0);

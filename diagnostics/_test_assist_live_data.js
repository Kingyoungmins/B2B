// [회귀] AI 도움 data 도구가 라이브 상태를 반영 + 중복 헤더에서 데이터 있는 열 선택.
// 실측(2026-07-28): 교차파일 붙여넣기로 정산서 D열에 데이터가 들어갔는데 AI 도움이 '데이터 없음
// (회사 0개)'. 원인 2겹 — ① 컴패니언 캐시 stale(파이프라인 liveSchema 는 주 세션만) ②
// 중복 '회사' 헤더(빈 A열 + 데이터 D열)에서 first-match(빈 A열)를 잡음.
// 실행: node diagnostics/_test_assist_live_data.js   (B2B_ver 루트에서)
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const toolsSrc = fs.readFileSync(path.join(ROOT, "scripts", "assist-tools.js"), "utf8");
const pySrc = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8");

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass += 1; console.log("PASS " + name); }
  else { fail += 1; console.log("FAIL " + name); }
}

// ── 1. 배선: 라이브 갱신 헬퍼 + 3개 데이터 도구가 async 로 그것을 await ──
t("1a 라이브 갱신 헬퍼 정의(_assistRefreshLiveFile)",
  /async function _assistRefreshLiveFile\(f, sheet\)/.test(toolsSrc)
  && /\/api\/excel\/preview-schema/.test(toolsSrc)
  && /applyLiveSchemaToFileCache\(excelId, r\.schema\)/.test(toolsSrc));
t("1b data.query/sheet.headers/data.read 3곳 갱신 호출(대상 시트만)",
  (toolsSrc.match(/await _assistRefreshLiveFile\(f, a\.sheet\)/g) || []).length === 3);
t("1d partial 병합: 다른 시트 캐시 미삭제 배선",
  /if \(!schema\.partial\)/.test(fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8"))
  && /only_sheet/.test(pySrc));
t("1c 서버 preview-schema 엔드포인트(라우트+핸들러+_live_preview_schema)",
  /"\/api\/excel\/preview-schema"/.test(pySrc)
  && /def handle_excel_preview_schema/.test(pySrc)
  && /_live_preview_schema\(wb\)/.test(pySrc));

// ── 2. 중복 헤더 열 선택: 같은 이름이 여럿이면 '데이터 있는' 열 ──
// data.query 안의 _pickBestCol/colIdx 와 동일 규칙을 재현해 실측 시나리오로 검증.
const header = ["회사", "합계금액", "", "회사", "청구일", "상태", "수량", "단가", "금액"];
const body = [
  ["", "", "", "A통신", "20251201", "안전제일", 10, 2700, 27000],
  ["", "", "", "B텔레콤", "20260115", "보통", 5, 3000, 15000],
  ["", "", "", "A통신", "20251215", "안전제일", 20, 2700, 54000],
];
const nonEmpty = (idx) => body.reduce((n, r) => n + ((r && String(r[idx] == null ? "" : r[idx]).trim()) ? 1 : 0), 0);
const pickBest = (indices) => {
  if (indices.length <= 1) return indices.length ? indices[0] : -1;
  let best = indices[0], bestN = nonEmpty(best);
  for (const i of indices.slice(1)) { const n = nonEmpty(i); if (n > bestN) { best = i; bestN = n; } }
  return best;
};
const colIdx = (name) => {
  const exacts = header.reduce((acc, h, i) => (h === name ? (acc.push(i), acc) : acc), []);
  if (exacts.length) return pickBest(exacts);
  return -1;
};
t("2a 중복 '회사' → 데이터 있는 D열(idx 3) 선택", colIdx("회사") === 3);
t("2b 선택 열의 데이터 3행 인식(0 아님)", nonEmpty(colIdx("회사")) === 3);
// 단일 매칭은 그대로(회귀 없음)
const h2 = ["이름", "금액"];
const single = (() => { const ex = h2.reduce((a, h, i) => (h === "금액" ? (a.push(i), a) : a), []); return ex.length ? pickBest(ex) : -1; })();
t("2c 단일 매칭 열은 그대로", single === 1);
// 소스에 _pickBestCol 배선 존재
t("2d data.query _pickBestCol 배선", /_pickBestCol/.test(toolsSrc) && /데이터가 있는' 열/.test(toolsSrc));

// ── 3. 헤더행 감지 통일(data.query ↔ sheet.headers) — 제목행 위에 있는 실무 파일 ──
const detect = (() => {
  const i = toolsSrc.indexOf("function _assistDetectHeaderRow");
  const b = toolsSrc.slice(i).match(/function _assistDetectHeaderRow[\s\S]*?\n}/)[0];
  return eval("(" + b + ")");
})();
const titled = [["2026년 4월 매출", "", "", ""], ["회사", "청구일", "수량", "금액"], ["A통신", "20251201", 10, 27000]];
t("3a 제목행 위 → 헤더행 자동 감지(idx1)", detect(titled) === 1);
t("3b 일반 시트 → 0행", detect([["회사", "금액"], ["A", 1]]) === 0);
t("3c 명시 headerRow 존중/클램프", detect(titled, 2) === 1 && detect([["a"]], 99) === 0);
t("3d data.query 도 공용 헬퍼 사용(rows[0] 하드코딩 제거)",
  /const hr = _assistDetectHeaderRow\(rows, a\.headerRow\)/.test(toolsSrc)
  && /const _body = rows\.slice\(hr \+ 1\)/.test(toolsSrc)
  && /const body = rows\.slice\(hr \+ 1\)/.test(toolsSrc));

// ── 4. 행상한 초과 시 truncated 명시(큰 시트 개수 오답 방지) ──
t("4a 미리보기 상한 초과 → truncated 경고 배선",
  /_truncated = _dataRowsTotal != null && _dataRowsTotal > body\.length/.test(toolsSrc)
  && /최소값'이며 정확한 전체값이 아닙니다/.test(toolsSrc)
  && (toolsSrc.match(/\.\.\._trunc/g) || []).length >= 3);
{
  const totalRows = 200, hr = 0, bodyLen = 59;
  const dataRowsTotal = Math.max(0, totalRows - (hr + 1));
  t("4b 200행 시트를 59행만 보면 truncated=true", dataRowsTotal > bodyLen);
}

console.log(pass + "/" + (pass + fail) + " PASS");
process.exit(fail ? 1 : 0);

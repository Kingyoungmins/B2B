// [0.8.4 AI 도움 — 2026-09-10 실측] "마진율 제일 적은거 3개 뽑아줘"(시트명 없는 질문)가 흔들림 —
//  같은 질문 3회: 정답 1 / "짝짓기가 안 돼요" 포기 1 / 원본 두 시트를 머릿속에서 결합해 3위 오답 1. 사용자(Qwen3.6)는 "파일 없다".
//  원인: ① 도구 파일 인자 '정확 일치'만(확장자 없음·시트명을 파일로·일부만 → unknown_file → "파일이 없다")
//        ② 프롬프트 팩트에 파일명만 — 'Sheet1' 추측, 요약 시트의 '마진율' 열을 모름 ③ 열→시트 찾기 도구 없음, groupBy 배열 미지원
//  실제 함수를 실행해 검증한다(정적 grep 아님).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "");
const TOOLS = read("scripts/assist-tools.js");
const CORE = read("scripts/assist-core.js");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 240) : "")); }
}

// ── 고정 상태: 입력 2개(매출/원가) + 출력 1개(회사별요약에 이미 '마진율' 열) ──
function makeState() {
  return {
    inputs: [
      { name: "input_매출_2026_4월.xlsx", sheetNames: ["매출", "고객정보"], sheets: {
          "매출": [["회사명", "상품", "건수", "금액"], ["ABC통신", "5G", 1, 100], ["ABC통신", "LTE", 2, 50], ["네오링크", "5G", 1, 30]],
          "고객정보": [["회사명", "담당자"], ["ABC통신", "김"]] } },
      { name: "input_원가_2026_4월.xlsx", sheetNames: ["원가"], sheets: { "원가": [["회사명", "상품", "원가"], ["ABC통신", "5G", 60]] } },
    ],
    outputTemplates: [{ file: { name: "output_청구서.xlsx", sheetNames: ["회사별요약", "월별실적"], sheets: {
        "회사별요약": [["■ 2026년 4월 요약", null, null, null, null], [null, null, null, null, null],
                    ["회사명", "매출", "원가", "마진", "마진율"], ["ABC통신", 150, 60, 90, 0.6], ["네오링크", 30, 20, 10, 0.33], ["합계", 180, 80, 100, null]],
        "월별실적": [["월", "매출"], ["4월", 180]] } } }],
    pipeline: [],
  };
}
const ctx = { state: makeState(), console };
vm.createContext(ctx);
vm.runInContext(TOOLS + "\nthis.ASSIST_TOOLS = ASSIST_TOOLS; this._assistResolveFile = _assistResolveFile; this._assistResolveSheet = _assistResolveSheet;"
  + " this._assistFileHeadersBrief = _assistFileHeadersBrief; this.assistRunTool = assistRunTool;", ctx, { filename: "assist-tools.js" });
const run = (name, args) => ctx.assistRunTool(name, args);

(async () => {
console.log("[1] 파일 이름 관대 해석 — _assistResolveFile");
{
  const R = (f, s) => ctx._assistResolveFile(f, s);
  check("정확 일치", R("output_청구서.xlsx").file.name === "output_청구서.xlsx");
  check("확장자 없이", (R("output_청구서") || {}).file?.name === "output_청구서.xlsx" && /확장자 보정/.test(R("output_청구서").note));
  check("대소문자/공백 무시", (R("OUTPUT_청구서.XLSX") || {}).file?.name === "output_청구서.xlsx");
  check("이름 일부(유일)", (R("청구서") || {}).file?.name === "output_청구서.xlsx" && /일부 일치/.test(R("청구서").note));
  check("이름 일부(모호: 'input_' 는 2개) → null(엉뚱한 파일 금지)", R("input_") === null);
  const bySheet = R("회사별요약");
  check("시트명을 파일 자리에 → 그 시트를 가진 파일 + sheet 보정", bySheet && bySheet.file.name === "output_청구서.xlsx" && bySheet.sheet === "회사별요약", JSON.stringify(bySheet));
  check("파일 못 찾아도 sheetHint 가 유일하면 그 파일", (R("없는파일", "원가") || {}).file?.name === "input_원가_2026_4월.xlsx");
  check("아무 단서도 없으면 null", R("없는파일") === null && R("") === null);
}

console.log("[2] 시트 이름 관대 해석 — _assistResolveSheet");
{
  const f = ctx.state.outputTemplates[0].file;
  const S = s => ctx._assistResolveSheet(f, s);
  check("정확 일치", S("회사별요약") === "회사별요약");
  check("앞뒤 공백/중간 공백", S(" 회사별요약 ") === "회사별요약" && S("회사별 요약") === "회사별요약");
  check("일부(유일)", S("요약") === "회사별요약");
  check("모르는 이름은 그대로(→ unknown_sheet 가 available 을 돌려준다)", S("Sheet1") === "Sheet1");
}

console.log("[3] columns.find — 열 이름으로 파일/시트 찾기");
{
  const r = await run("columns.find", { column: "마진율" });
  check("마진율 → 출력/회사별요약/E 정확 일치 1건", r.ok && r.matchCount === 1 && r.matches[0].file === "output_청구서.xlsx"
    && r.matches[0].sheet === "회사별요약" && r.matches[0].col === "E" && r.matches[0].exact === true && r.matches[0].headerRow === 3, JSON.stringify(r).slice(0, 300));
  check("안내: 요약 시트를 우선 읽으라", /원본 시트들을 다시 계산하지 말고/.test(r.note));
  const r2 = await run("columns.find", { column: "회사명" });
  check("회사명 → 4곳, 출력(요약) 시트가 먼저", r2.matchCount === 4 && r2.matches[0].role === "output", JSON.stringify(r2.matches.map(m => m.role + ":" + m.sheet)));
  const r3 = await run("columns.find", { column: "마진" });
  check("일부 일치 — '마진'(정확) 이 '마진율'(포함) 보다 앞", r3.matches[0].header === "마진" && r3.matches[1].header === "마진율", JSON.stringify(r3.matches));
  const r4 = await run("columns.find", { column: "없는열" });
  check("없으면 0건 + 대안 안내", r4.ok && r4.matchCount === 0 && /schema\.summary/.test(r4.note));
  const r5 = await run("columns.find", {});
  check("인자 없으면 missing_column", r5.ok === false && r5.error === "missing_column");
  const r6 = await run("columns.find", { args: { name: "마진율" } });
  check("{args:{name}} 포장·별칭도 통과", r6.ok && r6.matchCount === 1);
}

console.log("[4] data.query / sheet.headers / data.read — 관대한 인자로 실제 호출");
{
  const q1 = await run("data.query", { file: "청구서", sheet: "회사별 요약", op: "sample", column: "마진율", topN: 3 });
  check("file 일부 + sheet 공백 → 정상 조회(sample 은 요약 행 포함 3행)", q1.ok && q1.op === "sample" && q1.rows.length === 3, JSON.stringify(q1).slice(0, 200));
  const q2 = await run("data.query", { file: "회사별요약", op: "count", column: "회사명" });
  check("file 자리에 시트명 + sheet 생략 → 그 시트로(합계 행 제외 2건)", q2.ok && q2.matchedRows === 2, JSON.stringify(q2).slice(0, 200));
  const q3 = await run("data.query", { file: "없는것", sheet: "x", op: "count", column: "a" });
  check("정말 없으면 unknown_file + available + columns.find 안내('파일이 없다' 금지)", q3.ok === false && q3.error === "unknown_file"
    && q3.available.length === 3 && /columns\.find/.test(q3.hint) && /파일이 없다/.test(q3.hint), JSON.stringify(q3));
  const q4 = await run("data.query", { file: "output_청구서.xlsx", sheet: "Sheet1", op: "count", column: "회사명" });
  check("시트가 진짜 없으면 unknown_sheet + available + file", q4.ok === false && q4.error === "unknown_sheet" && q4.file === "output_청구서.xlsx"
    && q4.available.includes("회사별요약"), JSON.stringify(q4));
  const g = await run("data.query", { file: "input_매출_2026_4월.xlsx", sheet: "매출", op: "groupSum", column: "금액", groupBy: ["회사명", "상품"], topN: 10 });
  check("groupBy 배열(복합 키) 지원", g.ok && g.groupCount === 3 && g.top.some(t => t.key === "ABC통신 | 5G" && t.value === 100), JSON.stringify(g).slice(0, 240));
  const g1 = await run("data.query", { file: "input_매출_2026_4월.xlsx", sheet: "매출", op: "groupSum", column: "금액", groupBy: "회사명" });
  check("groupBy 단일 열은 종전대로", g1.ok && g1.groupCount === 2 && g1.top[0].key === "ABC통신" && g1.top[0].value === 150, JSON.stringify(g1).slice(0, 200));
  const gb = await run("data.query", { file: "input_매출_2026_4월.xlsx", sheet: "매출", op: "groupSum", column: "금액", groupBy: ["회사명", "없는열"] });
  check("배열 중 하나라도 없으면 unknown_groupBy", gb.ok === false && gb.error === "unknown_groupBy");
  const h = await run("sheet.headers", { file: "청구서.xlsx", sheet: "요약" });
  check("sheet.headers 도 관대 해석 + 응답 file 은 실제 이름", h.ok && h.file === "output_청구서.xlsx" && h.sheet === "회사별요약" && h.headers.map(x => x.name).join(",") === "회사명,매출,원가,마진,마진율", JSON.stringify(h).slice(0, 200));
  const d = await run("data.read", { file: "회사별요약", range: "A4:E5" });
  check("data.read 도 시트명을 파일로 준 경우 통과", d.ok && d.rows.length === 2 && d.rows[0][0] === "ABC통신", JSON.stringify(d).slice(0, 200));
}

console.log("[4b] rank — 값 열로 정렬한 상위/하위 N (도구가 정렬한다)");
{
  const r = await run("data.query", { file: "회사별요약", op: "rank", column: "마진율", order: "asc", topN: 3 });
  check("asc → 낮은 순, 요약 행 제외, 라벨=회사명 자동", r.ok && r.op === "rank" && r.order === "asc" && r.labelColumn === "회사명"
    && r.rows.map(x => x.label + ":" + x.value).join(",") === "네오링크:0.33,ABC통신:0.6" && r.rankedCount === 2, JSON.stringify(r).slice(0, 260));
  check("안내: 이 순서 그대로 답하라", /그대로 답하라/.test(r.note));
  const b = await run("data.query", { file: "output_청구서.xlsx", sheet: "회사별요약", op: "bottom", column: "마진율", topN: 1 });
  check("별칭 bottom → rank asc", b.ok && b.op === "rank" && b.order === "asc" && b.rows[0].label === "네오링크", JSON.stringify(b).slice(0, 200));
  const t = await run("data.query", { file: "output_청구서.xlsx", sheet: "회사별요약", op: "top", column: "매출", topN: 1 });
  check("별칭 top → rank desc", t.ok && t.order === "desc" && t.rows[0].label === "ABC통신" && t.rows[0].value === 150, JSON.stringify(t).slice(0, 200));
  const gs = await run("data.query", { file: "input_매출_2026_4월.xlsx", sheet: "매출", op: "groupSum", column: "금액", groupBy: "회사명", order: "asc" });
  check("groupSum order=asc → 작은 그룹 먼저", gs.ok && gs.order === "asc" && gs.top[0].key === "네오링크", JSON.stringify(gs).slice(0, 200));
  const sm = await run("data.query", { file: "output_청구서.xlsx", sheet: "회사별요약", op: "sample", column: "회사명,매출,원가,마진,마진율" });
  check("sample 에 콤마 열 목록을 줘도 통과(첫 열로)", sm.ok && sm.header.length === 5, JSON.stringify(sm).slice(0, 200));
  const sm2 = await run("data.query", { file: "output_청구서.xlsx", sheet: "회사별요약", op: "sample" });
  check("sample 은 column 없이도 된다", sm2.ok && sm2.rows.length === 3, JSON.stringify(sm2).slice(0, 200));
  const bad = await run("data.query", { file: "output_청구서.xlsx", sheet: "회사별요약", op: "sum", column: "회사명,매출" });
  check("sum 은 첫 열로 해석하되 열이 있으면 진행(회사명 → 숫자 0개)", bad.ok && bad.numericCells === 0);
  const un = await run("data.query", { file: "output_청구서.xlsx", sheet: "회사별요약", op: "sum", column: "없는열" });
  check("없는 열은 unknown_column + hint", un.ok === false && un.error === "unknown_column" && /열 이름 하나/.test(un.hint));
}

console.log("[5] schema.summary 에 시트별 헤더");
{
  const s = await run("schema.summary", {});
  const out = s.files.find(f => f.name === "output_청구서.xlsx");
  check("headersBySheet 포함", s.ok && out && out.headersBySheet["회사별요약"].join(",") === "회사명,매출,원가,마진,마진율", JSON.stringify(out));
  check("빈 시트는 null 로", out.headersBySheet["월별실적"].length === 2);
}

console.log("[6] 시스템 프롬프트 그라운딩 팩트 — 파일별 시트(열 이름) + 값 질문 규칙");
{
  const at = CORE.indexOf("function assistSystemPrompt");
  let d = 0, i = CORE.indexOf("{", at), end = -1;
  for (; i < CORE.length; i++) { if (CORE[i] === "{") d++; else if (CORE[i] === "}") { d--; if (d === 0) { end = i + 1; break; } } }
  const src = CORE.slice(at, end);
  const env = new Proxy({ state: ctx.state, _assistFileHeadersBrief: ctx._assistFileHeadersBrief, Array, Object, String, Number, JSON, Math },
    // 전역(Boolean·Array…)은 그대로 두고, 그 밖의 이름만 env 로 가로챈다(없으면 undefined → typeof 가드가 작동)
    { has: (t, k) => typeof k === "string" && !(k in globalThis) && k !== "assistSystemPrompt", get: (t, k) => (k in t ? t[k] : undefined) });
  const prompt = new Function("env", "with (env) { " + src + "\n return assistSystemPrompt(); }")(env);
  check("팩트에 '파일별 시트(열 이름)' 블록", /파일별 시트\(열 이름\)/.test(prompt));
  check("출력 파일의 요약 시트 헤더가 그대로 보인다", prompt.includes("output_청구서.xlsx — 시트: 회사별요약(회사명,매출,원가,마진,마진율) | 월별실적(월,매출)"), prompt.match(/output_청구서[^\n]*/)?.[0]);
  check("입력 파일도", prompt.includes("input_매출_2026_4월.xlsx — 시트: 매출(회사명,상품,건수,금액) | 고객정보(회사명,담당자)"));
  check("Sheet1 추측 금지 문구", /Sheet1\)을 부르지 마라/.test(prompt));
  check("순위 질문은 op=rank 규칙", /op=rank\(column=값 열, order=asc\|desc, topN=N\)/.test(prompt));
  check("[값을 묻는 질문] 규칙 — columns.find 먼저·요약 시트 우선·머릿속 계산 금지·'파일이 없다' 금지",
    /\[값을 묻는 질문/.test(prompt) && /columns\.find\(열 이름\)/.test(prompt) && /요약\/출력 시트에 그 열이 있으면 그 시트를 읽어 답하라/.test(prompt)
    && /머릿속에서 빼기·나누기/.test(prompt) && /"파일이 없다\/못 찾겠다"고 답하지 마라/.test(prompt));
  check("도구 카탈로그에 columns.find 가 올라간다", /columns\.find\(column\)/.test(vm.runInContext("assistToolCatalog()", ctx)));
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.log("CRASH", String(e && e.stack || e).slice(0, 400)); process.exit(1); });

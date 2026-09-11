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
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
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

console.log("[4c] 광역 실기(2026-09-10 17:04) 후속 — groupCount 열 불필요 · ctx.help · 근거 가드 오탐");
{
  const gc = await run("data.query", { file: "input_매출_2026_4월.xlsx", sheet: "매출", op: "groupCount", groupBy: ["상품"], order: "desc" });
  check("groupCount 는 column 없이 된다(배열 groupBy)", gc.ok && gc.groupCount === 2 && gc.top[0].key === "5G" && gc.top[0].value === 2, JSON.stringify(gc).slice(0, 200));
  // ctx.help — file-schema.js 의 실제 설명서를 읽는다
  const FS = read("scripts/file-schema.js");
  vm.runInContext(FS, ctx, { filename: "file-schema.js" });
  const all = await run("ctx.help", {});
  check("ctx.help 전체: 헬퍼 이름 목록(write·match_fill 포함, sheet 없음)", all.ok && all.helpers.includes("write") && all.helpers.includes("match_fill") && !all.helpers.includes("sheet"), JSON.stringify(all).slice(0, 200));
  check("ctx.help 전체에 서명(signatures) 포함 — 인자 추측 방지", Array.isArray(all.signatures) && all.signatures.some(x => x.startsWith("ctx.write(")) && all.signatures.some(x => x.startsWith("ctx.match_fill(")), JSON.stringify(all.signatures || []).slice(0, 200));
  const w = await run("ctx.help", { name: "match_fill" });
  check("ctx.help(match_fill) → 서명 줄", w.ok && w.exists === true && w.matches.some(m => /ctx\.match_fill\(/.test(m)), JSON.stringify(w).slice(0, 200));
  const no = await run("ctx.help", { name: "ctx.sheet(" });
  check("ctx.help(sheet) → 없다 + 대안 목록", no.ok && no.exists === false && /ctx\.sheet 는 없다/.test(no.note) && no.helpers.includes("read"), JSON.stringify(no).slice(0, 200));
  // 근거 가드 오탐 — 실제 함수 실행(파일명·단계 id·연월·목록 번호는 수치가 아니다)
  const at0 = CORE.indexOf("function assistLooksLikeDataClaimWithoutEvidence");
  let dd = 0, j = CORE.indexOf("{", at0), end0 = -1;
  for (; j < CORE.length; j++) { if (CORE[j] === "{") dd++; else if (CORE[j] === "}") { dd--; if (dd === 0) { end0 = j + 1; break; } } }
  ctx.state.pipeline = [{ id: "azk3o404", code: "x" }];
  vm.runInContext(CORE.slice(at0, end0) + "\nthis.assistLooksLikeDataClaimWithoutEvidence = assistLooksLikeDataClaimWithoutEvidence;", ctx);
  const G = (q, a) => ctx.assistLooksLikeDataClaimWithoutEvidence(q, a);
  check("사용법 안내(파일명 2026_4월 + 목록 번호 + F11)는 오탐 아님", G("스킬은 어떻게 만들어? 처음이라 순서를 모르겠어.",
    "지금 올라온 파일은 input_매출_2026_4월.xlsx, output_청구서.xlsx 입니다.\n1. 파일 올리기\n2. 말로 지시하기\n3. F11 로 AI 도움 열기") === false);
  check("단계 id(azk3o404)·연월(2026년 4월) 언급도 오탐 아님", G("5단계 왜 실패했어?", "5단계(azk3o404)는 2026년 4월 파일의 회사별요약 시트에 쓰는 단계입니다.") === false);
  check("진짜 수치 주장(도구 0회)은 여전히 잡는다", G("마진율 제일 낮은 3곳", "오리진네트 21.0%, 네오링크 23.0%, 매출 214,198,000") === true);
  check("금액 단위 수치도 잡는다", G("합계 얼마야", "합계는 3,797,128,000원입니다") === true);
  // [2차 실측] '5가지' 처럼 숫자 규칙에 안 걸리는 데이터 답도 — 값을 묻는 질문이면 도구 근거 필수
  check("'상품 종류가 몇 가지야?' 에 도구 0회 답(5가지+상품명)은 잡는다", G("매출 시트에 상품 종류가 몇 가지야? 제일 많이 팔린 상품은?", "상품 종류는 5가지입니다. 클라우드호스팅, 데이터백업, 보안솔루션, 서버렌탈, 네트워크장비") === true);
  check("값 질문이라도 '확인하지 못했다' 고 답하면 통과", G("회사별요약에 값이 비어 있는 회사 있어?", "지금은 파일 값을 확인하지 못했습니다. 시트 이름을 알려 주시면 읽어 보겠습니다.") === false);
  check("사용법 질문은 숫자(파일 3개)가 있어도 오탐 아님", G("스킬은 어떻게 만들어? 처음이라 순서를 모르겠어.", "지금 파일 3개가 올라와 있습니다. 시트는 회사별요약입니다. 설계 채팅에 한 문장씩 적으세요.") === false);
  check("스킬 만드는 법('어떻게 요청하면 돼?')은 값 질문이 아니다", G("원가 파일의 회사별원가합계 시트 값을 요약표 원가 열에 채우는 단계를 추가하고 싶어. 어떻게 요청하면 돼?", "설계 채팅에 이렇게 넣으세요: 원가 시트에서 회사별 원가 합계를 회사별요약 원가 열에 채워 주세요.") === false);
  ctx.state.pipeline = [];
  // 재촉 메타 문장 제거(assist-guard) — 실측 문장 그대로
  const GUARD = read("scripts/assist-guard.js");
  vm.runInContext(GUARD + "\nthis.assistStripNudgeMeta = assistStripNudgeMeta;", ctx, { filename: "assist-guard.js" });
  const M = s => ctx.assistStripNudgeMeta(s);
  const m1 = M("죄송합니다. 방금 수치와 회사명은 도구로 읽지 않고 제가 만들어낸 것이었습니다. 실제 값을 다시 확인했습니다.\n\n회사별요약 시트에는 20개 회사가 있는데, 비어 있는 회사는 없습니다.");
  check("사과·'만들어낸 것' 문단 제거, 내용 문단 유지", !/죄송|만들어낸|다시 확인했습니다/.test(m1) && /20개 회사/.test(m1), m1);
  const m1b = M("회사별요약 시트에는 20개 회사가 있습니다. 죄송합니다. 방금 전 턴에서 말한 값은 틀렸습니다. 비어 있는 회사는 없습니다.");
  check("본문 사이에 낀 메타+사과 문장만 제거", !/죄송|방금 전 턴/.test(m1b) && /20개 회사/.test(m1b) && /비어 있는 회사는 없습니다/.test(m1b), m1b);
  const m2 = M("다시 확인해 봤습니다. 방금 답변에 따옴표로 감싼 '요청문'은 없었어요. 그래서 handoff 카드가 필요 없고, 같은 답변을 그대로 다시 드립니다.\n\n처음 쓰시는 거라면 순서는 이렇게 됩니다.\n\n1. 파일을 올립니다.");
  check("handoff 메타 문단 제거, 안내 본문 유지", !/handoff|다시 확인해 봤습니다|따옴표/.test(m2) && /처음 쓰시는 거라면/.test(m2) && /1\. 파일을 올립니다/.test(m2), m2);
  const m3 = M("두 시트를 실제로 읽어서 비교했습니다. 전부 일치합니다.\n\n참고로, 방금 전 턴에서 제가 \"DEF에너지·QRS미디어가 5,000 차이 난다\"고 말한 것은 틀린 것이었습니다. 그 회사명은 이 파일에 아예 없습니다. 죄송합니다.");
  check("본문 뒤에 붙은 '방금 전 턴' 정정 문단 제거", !/방금 전 턴|DEF에너지|죄송/.test(m3) && /전부 일치합니다/.test(m3), m3);
  const m4 = M("마진율이 가장 낮은 3곳은 오리진네트, 네오링크, 메이저텔레콤입니다. 방금 읽은 rank 결과 그대로입니다.");
  check("일반 문장은 그대로", m4.includes("오리진네트") && m4.includes("rank 결과 그대로"), m4);
  check("전부 메타면 원문 유지(정보 유실 방지)", M("죄송합니다. 방금 답변은 제가 만들어낸 것이었습니다.").length > 0);
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

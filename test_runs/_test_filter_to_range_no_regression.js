// [지시 2026-08-27] "예전에 만든 스킬들과 충돌하지 않도록 유념하며, 코드로 검증하도록."
//
// filter_to_range 를 넣으면서 기존 코드에 손댄 곳은 딱 두 군데다. 그 둘이 예전 스킬의 판정을
// 바꾸지 않는다는 것을 '코드로' 확인한다(눈으로 훑고 넘어가지 않는다).
//   ① scripts/chat-ui.js  codeUsesSafeCtxHelper 정규식에 filter_to_range 추가
//   ② scripts/file-schema.js 프롬프트에 사용법 추가(문구만)
//
// 위험 가설과 확인 방법
//   · ①이 예전 스킬 코드의 판정을 true→false 로 뒤집으면 큰 파일 작업이 VBA 로 강제 전환된다
//     → 예전 헬퍼 코드 표본을 전부 넣어 판정이 그대로인지 본다. 정규식을 '추가 전' 형태로
//        되돌려 만든 판정기와 결과를 직접 비교한다(추론이 아니라 대조).
//   · 새 함수가 '시트를 만드는 헬퍼'로 오인되면 실행기 파일확인 매핑이 꼬인다
//     → diagnostics/_test_creator_sheets.js 가 따로 잠근다(여기서는 그 검사가 살아 있는지만 확인).
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const CHAT = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");
const SCHEMA = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8").replace(/^﻿/, "");
const CREATOR = fs.readFileSync(path.join(ROOT, "diagnostics", "_test_creator_sheets.js"), "utf8");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 240) : "")); }
}

/* 소스에서 판정기를 떼어내 실제로 돌린다. */
function makeSafeHelperFn(src) {
  const i = src.indexOf("function codeUsesSafeCtxHelper");
  if (i < 0) throw new Error("codeUsesSafeCtxHelper 못 찾음");
  const end = src.indexOf("\n}", i) + 2;
  return new Function(src.slice(i, end) + "\nreturn codeUsesSafeCtxHelper;")();
}
const now = makeSafeHelperFn(CHAT);
// '추가 전' 판정기 — 정규식에서 filter_to_range 만 빼서 예전 동작을 그대로 재현한다.
const before = makeSafeHelperFn(CHAT.replace("|filter_to_range|", "|"));

// 예전 스킬에서 실제로 쓰이던 형태들(저장 스킬 zip·기존 테스트에서 뽑은 대표 표본)
const OLD_SAMPLES = [
  'ctx.filter_to_sheet("Sheet1", lambda r: r[2] == "안전제일", "안전제일목록")',
  'ctx.pivot("매출", group_by="지점", value="금액", agg="sum", dest_name="요약")',
  'ctx.copy("원본", "A1:F30", "요약", "A1")',
  'ctx.copy_sheet("가시트", dst_book="출력.xlsx")',
  'ctx.sort("데이터", "A1:F200", "B")',
  'ctx.paste_copied("회선 현황", "A2:N57", "대상", "A2")',
  'ctx.append_same_format_sheets(["a.xlsx","b.xlsx"], dest_sheet="통합")',
  'ctx.delete_rows("데이터", "1:9")',
  'ctx.add_sheet("요약", after="데이터")',
  'ctx.fill_sum_col("정산", "합계", ["1월","2월"])',
  'ctx.move_cols("정산", ["단가","금액"], "J")',
  'ctx.shift_months("표지", "A1:F5", 1)',
  // 헬퍼가 아닌 원시 코드 — 예전에도 false 였고 지금도 false 여야 한다
  'ctx.write("S", "A1", [[1]])',
  'ctx.read("S")',
  'for r in rows: ctx.write_cell("S", "A%d" % r, 1)',
  '',
];

console.log("[1] 예전 스킬 코드의 판정이 하나도 안 바뀐다 (추가 전/후 직접 대조)");
let diffs = [];
OLD_SAMPLES.forEach(code => {
  if (now(code) !== before(code)) diffs.push({ code: code.slice(0, 60), before: before(code), now: now(code) });
});
check("표본 " + OLD_SAMPLES.length + "종 판정 동일", diffs.length === 0, diffs);
check("헬퍼 코드는 여전히 true",
  OLD_SAMPLES.slice(0, 12).every(c => now(c) === true),
  OLD_SAMPLES.slice(0, 12).filter(c => now(c) !== true));
check("원시 코드는 여전히 false",
  OLD_SAMPLES.slice(12).every(c => now(c) === false),
  OLD_SAMPLES.slice(12).filter(c => now(c) !== false));

console.log("[2] 새 함수는 새로 true 가 된다(그래야 VBA 강제 전환에 안 걸린다)");
const NEWCODE = 'ctx.filter_to_range("회선 현황", ctx.column_is(2, ["정지"]), "대상양식", "A3")';
check("추가 전이었다면 false", before(NEWCODE) === false, before(NEWCODE));
check("지금은 true", now(NEWCODE) === true, now(NEWCODE));

console.log("[3] 정규식 변경이 '추가'뿐임을 구조로 확인");
// 대안(|) 하나만 늘었는지 — 다른 이름이 사라졌으면 예전 스킬이 조용히 판정을 잃는다.
function alts(src) {
  const m = /codeUsesSafeCtxHelper[\s\S]*?\(\?:([^)]+)\)/.exec(src);
  return m ? m[1].split("|") : [];
}
const A0 = alts(CHAT.replace("|filter_to_range|", "|"));
const A1 = alts(CHAT);
check("예전 이름이 하나도 안 사라졌다", A0.every(x => A1.includes(x)), A0.filter(x => !A1.includes(x)));
check("새로 늘어난 것은 filter_to_range 하나뿐",
  A1.filter(x => !A0.includes(x)).join(",") === "filter_to_range", A1.filter(x => !A0.includes(x)));

console.log("[4] 프롬프트 변경은 '문구 추가'이고 기존 안내를 지우지 않았다");
[
  "필터(새 시트 추출)=ctx.filter_to_sheet",
  "조건으로 걸러 새 시트에 추출 | ctx.filter_to_sheet",
  "ctx.apply_filter",
  "ctx.delete_rows_where",
].forEach(s => check("기존 안내 유지: " + s.slice(0, 34), SCHEMA.includes(s)));
check("새 안내가 들어갔다", SCHEMA.includes("ctx.filter_to_range"));
check("새 안내가 '좌표를 박지 말라'는 이유를 담는다",
  /범위를 좌표로 박지 마세요/.test(SCHEMA));

console.log("[5] 생성시트 오등록 방지 검사가 살아 있다");
check("탐지기 테스트에 filter_to_range 케이스가 있다",
  /filter_to_range 는 생성시트로 등록하지 않는다/.test(CREATOR));
check("대조군(filter_to_sheet 는 등록)도 함께 확인한다",
  /filter_to_sheet 는 종전대로 등록한다/.test(CREATOR));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);

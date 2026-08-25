// [제보 2026-08-25] "통화요금이 0인 행 전부 삭제" 스킬이 filter_to_sheet 추출 후 원본 시트를
// delete_sheet(+rename)로 '교체'하는 재구성으로 생성됨 — 라이브 미러가 그 시트를 보고 있어
// 적용 직후 화면이 깨졌다(사용자: "정상적인 엑셀화면으로 나오지 않음"). 두 겹으로 잠근다:
//   1. 생성 규칙: '조건 행 삭제' 문구 → ctx.delete_rows_where 매핑 + 교체 재구성 명시 금지
//   2. 정적 게이트: 추출원본을 delete_sheet 하는 조합을 적용 전에 차단(자동 재생성 유도)
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const fsrc = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8").replace(/^﻿/, "");
const cu = fs.readFileSync(path.join(ROOT, "scripts", "chat-ui.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}
// 중괄호 카운팅은 함수 안 정규식/문자열의 '}' 에 속아 일찍 닫힌다(실측) — 이 파일은
// 최상위 함수가 컬럼 0 의 "function " 으로 시작하므로 '다음 최상위 함수 직전까지'를 자른다.
function fnSrc(src, name) {
  const at = src.indexOf("function " + name);
  if (at < 0) throw new Error("함수 못 찾음: " + name);
  const next = src.indexOf("\nfunction ", at + 1);
  const chunk = src.slice(at, next < 0 ? src.length : next);
  // 함수 뒤에 붙은 최상위 const/주석은 무해(선언일 뿐 실행 부작용 없음)하지만, 닫는 중괄호
  // 이후의 잔여물은 잘라낸다: 마지막 "\n}" 까지만 취한다.
  const end = chunk.lastIndexOf("\n}");
  return end < 0 ? chunk : chunk.slice(0, end + 2);
}

console.log("[1] 생성 규칙 — '조건 행 삭제'가 delete_rows_where 로 매핑되고 교체 재구성이 금지된다");
check("'조건에 맞는 행 삭제' 문구 매핑", /조건에 맞는 행을\(예: 통화요금이 0인 행 전부\) 삭제해줘/.test(fsrc));
check("추출→delete_sheet/rename 교체 금지 명시", /delete_sheet\/rename 으로 '교체'하는 방식도 금지/.test(fsrc));
check("filter_to_sheet 규칙에 반대 방향 안내('삭제'는 delete_rows_where)", /반대로 "행을 삭제해줘"[\s\S]{0,80}ctx\.delete_rows_where/.test(fsrc));
check("헤더 여러 행이면 header_rows 안내", /header_rows=2.*로 넘기세요/.test(fsrc));

console.log("[2] 정적 게이트 — 추출원본 delete_sheet 조합만 좁게 차단(동작 검증)");
{
  // 의존 함수는 통과 스텁으로 — 이 테스트는 '교체 재구성' 분기만 본다.
  const body = fnSrc(cu, "pythonComStaticSafetyFailures")
    + "\n" + fnSrc(cu, "_stripPythonCommentsForGate");
  const mk = new Function(
    body
    + "\nfunction negativeSignLossFailures(){ return []; }"
    + "\nreturn pythonComStaticSafetyFailures;",
  );
  // 주의: new Function 본문 안에서 negativeSignLossFailures 를 pythonComStaticSafetyFailures 보다
  // 뒤에 선언해도 호이스팅으로 유효하다.
  const gate = mk();
  const bad = [
    'def transform(ctx):',
    '    sheet = "VIEW"',
    '    fee_col = ctx.find_header(sheet, "통화요금", header_row=2)',
    '    ctx.filter_to_sheet("VIEW", lambda r: str(r[fee_col-1]).strip() not in ("0",), "VIEW_임시")',
    '    ctx.delete_sheet("VIEW")',
    '    ctx.rename_sheet("VIEW_임시", "VIEW")',
  ].join("\n");
  const f1 = gate(bad, "");
  check("교체 재구성(추출원본 delete_sheet)이 잡힌다", f1.some(m => m.includes("교체")), JSON.stringify(f1));
  check("메시지가 delete_rows_where 로 안내한다", f1.some(m => m.includes("delete_rows_where")));

  const good = [
    'def transform(ctx):',
    '    fee_col = ctx.find_header("VIEW", "통화요금", header_row=2)',
    '    ctx.delete_rows_where("VIEW", lambda r: str(r[fee_col-1]).replace(",", "").strip() in ("0", "0.0"), header_rows=2)',
  ].join("\n");
  check("제자리 삭제(정답 코드)는 통과", !gate(good, "").some(m => m.includes("교체")));

  const move = [
    'def transform(ctx):',
    '    ctx.copy_sheet("a시트", dst_book="b.xlsx")',
    '    ctx.delete_sheet("a시트")',
  ].join("\n");
  check("시트 이동(copy_sheet 후 delete_sheet)은 오탐 없음", !gate(move, "").some(m => m.includes("교체")));

  const extractOnly = [
    'def transform(ctx):',
    '    ctx.filter_to_sheet("VIEW", lambda r: True, "추출")',
    '    ctx.delete_sheet("다른시트")',
  ].join("\n");
  check("추출원본이 아닌 시트 삭제는 오탐 없음", !gate(extractOnly, "").some(m => m.includes("교체")));
}

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);

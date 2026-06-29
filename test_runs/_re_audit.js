// [감사] 파이썬 적용-前 정적검사의 [\s\S]{0,N} 다중 정규식 backtracking 측정(적대적 입력).
// 각 정규식을 chat-ui.js 에서 그대로 복사. >500ms 면 폭발 후보.
const tests = [];
function reg(name, re, normal, adversarial) { tests.push({ name, re, normal, adversarial }); }

// 1) non_none (chat-ui.js:1205) — [\s\S]{0,300} ... {0,120} ... {0,120} ... {0,900} 4연속
reg("non_none",
  /\bnon_none\s*=\s*\[[\s\S]{0,300}\bfor\b[\s\S]{0,120}\bif\b[\s\S]{0,120}is\s+not\s+None[\s\S]{0,900}\bctx\s*\.\s*write\s*\([^)]*\bnon_none\b/i,
  'non_none = [r for r in rows if r[0] is not None]\nctx.write("S", "A1", [non_none])',
  // 적대적: 앵커는 다 있는데 마지막 write 괄호 안 non_none 이 없어 끝까지 backtrack
  'non_none = [' + ' for x if y is not None z ctx.write(q) '.repeat(120));

// 2) headerFalseOnRowOneRange (chat-ui.js:1249) — [\s\S]{0,240} 단일
reg("sort_header",
  /ctx\.sort\s*\([\s\S]{0,240}["'][A-Z]{1,3}\$?1\s*:/i,
  'ctx.sort("S", "A1:L99", key_col="L")',
  'ctx.sort(' + 'x'.repeat(240) + ' "A1' /* ':' 없음 → 마지막 실패 */ );

// 3) reSubMatches (chat-ui.js:741) — [^"']* ... [^\]]* ... [^"']* 다중
reg("re_sub",
  /re\s*\.\s*sub\s*\(\s*r?["'][^"']*\[\^[^\]]*0-9[^\]]*\][^"']*["']\s*,\s*["']{2}/gi,
  're.sub(r"[^0-9]", "", s)',
  're.sub(r"' + 'x'.repeat(4000) /* 닫는 따옴표/클래스 없음 */ );

// 4) VBA rowDeleteLoop (chat-ui.js:1041/1053) — [\s\S]{0,1800} 단일(VBA 기본엔진)
reg("vba_rowdel",
  /\bFor\b[\s\S]{0,1800}\b(?:Rows\s*\([^\n\r]*\)|EntireRow)\s*\.\s*Delete\b/i,
  'For i = 1 To n\n  Rows(i).Delete\nNext',
  // 적대적: For 다수(각각 1800자 스캔) + Delete 전혀 없음 → N×1800 최악
  ('For i\n' + '  x = x + 1\n'.repeat(60)).repeat(200));

let bad = 0;
for (const t of tests) {
  for (const [kind, input] of [["normal", t.normal], ["adversarial", t.adversarial]]) {
    const re = new RegExp(t.re.source, t.re.flags.replace("g", "")); // test 용 g 제거(lastIndex 영향 제거)
    const t0 = Date.now();
    let r; try { r = re.test(input); } catch (e) { r = "ERR"; }
    const dt = Date.now() - t0;
    const flag = dt > 500 ? "  <== 폭발 후보" : "";
    if (dt > 500) bad++;
    console.log(`${t.name.padEnd(12)} ${kind.padEnd(12)} ${String(r).padEnd(6)} ${dt}ms${flag}`);
  }
}
console.log(`\n=== ${bad === 0 ? "모두 안전(<500ms)" : bad + "개 폭발 후보"} ===`);
process.exit(bad ? 1 : 0);

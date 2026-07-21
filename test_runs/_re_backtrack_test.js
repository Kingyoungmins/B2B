// [검증] loopWrite 검사를 정규식(catastrophic backtracking) → 줄단위 스캔으로 교체한 새 로직.
// (1) 슬로우 코드에서 즉시(폭발 X) (2) 슬로우/빠른=false 유지 (3) 진짜 루프내 쓰기=true.

// chat-ui.js 의 새 로직과 동일하게 재현 (recv 별칭은 ctx + ctx.book 연쇄)
function loopWriteHit(scanText) {
  const ctxAliases = new Set(["ctx"]);
  const aliasRe = /(\w+)\s*=\s*(\w+)\s*\.\s*book\s*\(/g;
  let grew = true;
  while (grew) {
    grew = false; let am; aliasRe.lastIndex = 0;
    while ((am = aliasRe.exec(scanText)) !== null) {
      if (ctxAliases.has(am[2]) && !ctxAliases.has(am[1])) { ctxAliases.add(am[1]); grew = true; }
    }
  }
  const recv = Array.from(ctxAliases).join("|");
  const ctxWriteRe = new RegExp(
    "\\b(?:" + recv + ")\\s*(?:\\.\\s*book\\s*\\([^\\n]*?\\))?" +
    "\\s*\\.\\s*(?:write|write_cell|write_formulas|insert_rows|insert_cols|merge|unmerge|sort)\\s*\\("
  );
  const lines = scanText.split("\n");
  const indentLen = (s) => /^[ \t]*/.exec(s)[0].length;
  for (let i = 0; i < lines.length; i++) {
    const h = /^([ \t]*)(?:for|while)\s[^\n]*:[ \t]*$/.exec(lines[i]);
    if (!h) continue;
    const headIndent = h[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      const ln = lines[j];
      if (ln.trim() === "") continue;
      if (indentLen(ln) <= headIndent) break;
      if (ctxWriteRe.test(ln)) return true;
    }
  }
  return false;
}

const cases = [
  ["SLOW(else/try, write 밖)", false, [
    'def transform(ctx):',
    '    sheet = "청구내역"',
    '    rows = ctx.read(sheet, "G2:G13")',
    '    total = 0.0',
    '    for r in rows:',
    '        v = r[0]',
    '        if isinstance(v, (int, float)):',
    '            total += float(v)',
    '        else:',
    '            s = str(v or "").replace(",", "").strip()',
    '            if s and s not in ("-",):',
    '                try:',
    '                    total += float(s)',
    '                except ValueError:',
    '                    pass',
    '    ctx.write_cell(sheet, "G15", total)',
  ].join("\n")],
  ["FAST(write 밖)", false, [
    'def transform(ctx):',
    '    rows = ctx.read("청구내역", "G2:G13")',
    '    total = 0.0',
    '    for r in rows:',
    '        v = r[0]',
    '        if isinstance(v, (int, float)):',
    '            total += v',
    '    ctx.write_cell("청구내역", "G15", total)',
  ].join("\n")],
  ["TRUE+ (루프 안 write)", true, [
    'def transform(ctx):',
    '    for i in range(10):',
    '        ctx.write_cell("S", "A" + str(i), i)',
  ].join("\n")],
  ["TRUE+ (루프 안 book.write)", true, [
    'def transform(ctx):',
    '    out = ctx.book("결과.xlsx")',
    '    for i in range(10):',
    '        out.write("S", "A1", i)',
  ].join("\n")],
  ["NEG (중첩 if 안, write는 루프 밖)", false, [
    'def transform(ctx):',
    '    acc = []',
    '    for r in ctx.read("S", "A1:A9"):',
    '        if r[0]:',
    '            acc.append(r[0])',
    '    ctx.write("S", "B1", [acc])',
  ].join("\n")],
];

let pass = 0, fail = 0, slowest = 0;
for (const [name, expect, code] of cases) {
  const t0 = Date.now();
  const got = loopWriteHit(code);
  const dt = Date.now() - t0;
  slowest = Math.max(slowest, dt);
  const ok = got === expect;
  console.log(`${ok ? " OK " : "FAIL"} ${name}: got=${got} expect=${expect}  (${dt} ms)`);
  if (ok) pass++; else fail++;
}
console.log(`\n=== ${pass}/${pass + fail} PASS, 최대 ${slowest}ms (1000ms 미만이어야 폭발 해소) ===`);
process.exit(fail || slowest > 1000 ? 1 : 0);

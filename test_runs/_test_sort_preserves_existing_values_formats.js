const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "serve_b2b.py"), "utf8");

function sliceBetween(startNeedle, endNeedle, from = 0) {
  const s = src.indexOf(startNeedle, from);
  if (s < 0) throw new Error("slice start not found: " + startNeedle);
  const e = src.indexOf(endNeedle, s + startNeedle.length);
  if (e < 0 || e <= s) throw new Error("slice end not found: " + endNeedle);
  return src.slice(s, e);
}

let pass = 0;
let fail = 0;
function ck(name, cond) {
  if (cond) {
    pass += 1;
    console.log(" OK  " + name);
  } else {
    fail += 1;
    console.log("FAIL " + name);
  }
}

const pyComSort = sliceBetween(
  "    def sort(self, sheet, a1_range, key_col, ascending=True, has_header=True):",
  "    # ---- 표시/서식 ----"
);

const excelClassStart = src.indexOf("class ExcelSkillContext:");
const excelSort = sliceBetween(
  "    def sort(self, sheet_or_name, by, ascending=True, header=True, workbook=None):",
  "    def filter_to_sheet(self, sheet_or_name, predicate, dest_name, header_rows=1, workbook=None):",
  excelClassStart
);

ck("Python COM ctx.sort uses native SortFields", /Sort\.SortFields\.Add/.test(pyComSort));
ck("Python COM ctx.sort disables text-as-number sorting", /DataOption\s*=\s*0/.test(pyComSort));
ck("legacy COM ctx.sort uses native SortFields", /Sort\.SortFields\.Add/.test(excelSort));
ck("legacy COM ctx.sort disables text-as-number sorting", /DataOption\s*=\s*0/.test(excelSort));
ck("legacy COM ctx.sort does not rewrite value grids", !/_write_grid\s*\(/.test(excelSort) && !/\.Value2?\s*=/.test(excelSort));
ck("legacy COM ctx.sort documents value/format preservation", /값·수식·서식/.test(excelSort));

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

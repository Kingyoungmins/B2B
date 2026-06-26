/* ===================================================================
   MINI FORMULA ENGINE
   ===================================================================
   원본 xlsx 에 적힌 수식을 시뮬레이터에서 실시간 재평가하기 위한
   소규모 평가기.

   지원:
     - 셀/범위 참조: A1, $A$1, A1:B10
     - 함수: SUM, AVERAGE, AVG, COUNT, COUNTA, MAX, MIN, IF, IFERROR,
             ROUND, ROUNDUP, ROUNDDOWN, ABS, AND, OR, NOT, LEN
     - 산술: + - * / ^ , 단항 +/-
     - 비교: = <> < > <= >=
     - 문자열 결합: &
     - 백분율: 5%

   미지원 (원본 xlsx 캐시 값으로 fallback):
     - 다른 시트 참조 (Sheet1!A1)
     - VLOOKUP / INDEX / MATCH 등 lookup 함수
     - 배열 수식
   =================================================================== */

const FORMULA_ERROR = "#ERROR!";
const FORMULA_UNSUPPORTED = Symbol("formula-unsupported");

const FORMULA_FN = {
  SUM(args) { return args.flat().reduce((a, v) => a + (Number(v) || 0), 0); },
  AVERAGE(args) {
    const nums = args.flat().filter(v => typeof v === "number" || (v !== "" && !isNaN(Number(v))));
    if (nums.length === 0) return 0;
    return nums.reduce((a, v) => a + Number(v), 0) / nums.length;
  },
  AVG(args) { return FORMULA_FN.AVERAGE(args); },
  COUNT(args) {
    return args.flat().filter(v => typeof v === "number" || (v !== "" && v !== null && !isNaN(Number(v)))).length;
  },
  COUNTA(args) {
    return args.flat().filter(v => v !== "" && v !== null && v !== undefined).length;
  },
  MAX(args) {
    const nums = args.flat().map(v => Number(v)).filter(n => !isNaN(n));
    return nums.length ? Math.max(...nums) : 0;
  },
  MIN(args) {
    const nums = args.flat().map(v => Number(v)).filter(n => !isNaN(n));
    return nums.length ? Math.min(...nums) : 0;
  },
  IF(args) {
    const [cond, t, f] = args;
    return _truthy(cond) ? (t !== undefined ? t : true) : (f !== undefined ? f : false);
  },
  IFERROR(args) {
    const [val, fallback] = args;
    if (val instanceof Error || val === FORMULA_ERROR) return fallback;
    return val;
  },
  ROUND(args) { const [v, d] = args; return Math.round(Number(v) * Math.pow(10, d || 0)) / Math.pow(10, d || 0); },
  ROUNDUP(args) { const [v, d] = args; const m = Math.pow(10, d || 0); return Math.ceil(Number(v) * m) / m; },
  ROUNDDOWN(args) { const [v, d] = args; const m = Math.pow(10, d || 0); return Math.trunc(Number(v) * m) / m; },
  ABS(args) { return Math.abs(Number(args[0]) || 0); },
  AND(args) { return args.flat().every(_truthy); },
  OR(args) { return args.flat().some(_truthy); },
  NOT(args) { return !_truthy(args[0]); },
  LEN(args) { return String(args[0] || "").length; },
};

function _truthy(v) {
  if (v === FORMULA_ERROR) return false;
  if (v === "" || v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return true;
}

function _colRefToIdx(letters) {
  let n = 0;
  letters = letters.toUpperCase();
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function _parseCellRef(ref) {
  const m = /^\$?([A-Za-z]+)\$?([0-9]+)$/.exec(ref);
  if (!m) return null;
  return { c: _colRefToIdx(m[1]), r: parseInt(m[2], 10) - 1 };
}

function _readCell(sheet, r, c, results) {
  if (!sheet || r < 0 || c < 0) return "";
  // 수식 결과 맵이 있고, 이 셀에 평가된 값이 들어있으면 그쪽을 우선.
  // (수식이 다른 수식을 참조하는 의존 체인 처리 — fixpoint 반복으로 채워짐)
  if (results) {
    const n = c + 1;
    let s = ""; let nn = n;
    while (nn > 0) { const rr = (nn - 1) % 26; s = String.fromCharCode(65 + rr) + s; nn = Math.floor((nn - 1) / 26); }
    const addr = s + (r + 1);
    if (Object.prototype.hasOwnProperty.call(results, addr)) {
      const rv = results[addr];
      if (rv !== FORMULA_UNSUPPORTED) {
        if (typeof rv === "string" && rv !== "" && !isNaN(Number(rv))) return Number(rv);
        return rv;
      }
    }
  }
  const row = sheet[r];
  if (!row) return "";
  const v = row[c];
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "" && !isNaN(Number(v))) return Number(v);
  return v;
}

// ----- Tokenizer -----
function _tokenize(s) {
  const tokens = [];
  let i = 0;
  const len = s.length;
  while (i < len) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    if (ch === '"') {
      let str = "";
      i++;
      while (i < len) {
        if (s[i] === '"') {
          if (s[i + 1] === '"') { str += '"'; i += 2; continue; }
          i++; break;
        }
        str += s[i++];
      }
      tokens.push({ t: "str", v: str });
      continue;
    }
    if (ch >= "0" && ch <= "9" || (ch === "." && s[i + 1] >= "0" && s[i + 1] <= "9")) {
      let num = "";
      while (i < len && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ t: "num", v: parseFloat(num) });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let id = "";
      while (i < len && /[A-Za-z0-9_$.]/.test(s[i])) id += s[i++];
      // function name? next non-space is "("
      let j = i;
      while (j < len && /\s/.test(s[j])) j++;
      if (s[j] === "(") {
        tokens.push({ t: "fn", v: id.toUpperCase() });
        continue;
      }
      // cell ref like A1, $A$1
      const refMatch = /^\$?[A-Za-z]+\$?[0-9]+$/.exec(id);
      if (refMatch) {
        // range?
        if (s[i] === ":") {
          let next = "";
          let k = i + 1;
          if (s[k] === "$") next += s[k++];
          while (k < len && /[A-Za-z]/.test(s[k])) next += s[k++];
          if (s[k] === "$") next += s[k++];
          while (k < len && /[0-9]/.test(s[k])) next += s[k++];
          if (/^\$?[A-Za-z]+\$?[0-9]+$/.test(next)) {
            tokens.push({ t: "range", v: { from: id, to: next } });
            i = k;
            continue;
          }
        }
        tokens.push({ t: "ref", v: id });
        continue;
      }
      // boolean / unknown identifier
      if (/^TRUE$/i.test(id)) { tokens.push({ t: "bool", v: true }); continue; }
      if (/^FALSE$/i.test(id)) { tokens.push({ t: "bool", v: false }); continue; }
      tokens.push({ t: "id", v: id });
      continue;
    }
    // operators
    if (ch === "<" && s[i + 1] === "=") { tokens.push({ t: "op", v: "<=" }); i += 2; continue; }
    if (ch === ">" && s[i + 1] === "=") { tokens.push({ t: "op", v: ">=" }); i += 2; continue; }
    if (ch === "<" && s[i + 1] === ">") { tokens.push({ t: "op", v: "<>" }); i += 2; continue; }
    if ("+-*/^&=<>".indexOf(ch) >= 0) { tokens.push({ t: "op", v: ch }); i++; continue; }
    if (ch === "%") { tokens.push({ t: "op", v: "%" }); i++; continue; }
    if (ch === "(") { tokens.push({ t: "lp" }); i++; continue; }
    if (ch === ")") { tokens.push({ t: "rp" }); i++; continue; }
    if (ch === ",") { tokens.push({ t: "comma" }); i++; continue; }
    // unknown character — skip
    i++;
  }
  return tokens;
}

// ----- Parser (precedence climbing) -----
//
// expr   = compare
// compare = concat (("=" | "<>" | "<" | ">" | "<=" | ">=") concat)*
// concat = addsub ("&" addsub)*
// addsub = muldiv (("+" | "-") muldiv)*
// muldiv = power (("*" | "/") power)*
// power  = unary ("^" unary)*
// unary  = ("-" | "+") unary | postfix
// postfix = primary ("%")?
// primary = num | str | bool | "(" expr ")" | fn "(" args ")" | ref | range

function _parser(tokens) {
  let i = 0;
  function peek() { return tokens[i]; }
  function eat(t, v) {
    const tok = tokens[i];
    if (!tok) throw new Error("parse: 토큰 부족");
    if (t && tok.t !== t) throw new Error(`parse: ${t} 기대, ${tok.t} 받음`);
    if (v !== undefined && tok.v !== v) throw new Error(`parse: ${v} 기대, ${tok.v} 받음`);
    i++; return tok;
  }
  function isOp(...ops) { const t = tokens[i]; return t && t.t === "op" && ops.indexOf(t.v) >= 0; }

  function parseExpr() { return parseCompare(); }
  function parseCompare() {
    let left = parseConcat();
    while (isOp("=", "<>", "<", ">", "<=", ">=")) {
      const op = eat("op").v;
      const right = parseConcat();
      left = { type: "bin", op, left, right };
    }
    return left;
  }
  function parseConcat() {
    let left = parseAddSub();
    while (isOp("&")) { eat("op"); const right = parseAddSub(); left = { type: "bin", op: "&", left, right }; }
    return left;
  }
  function parseAddSub() {
    let left = parseMulDiv();
    while (isOp("+", "-")) { const op = eat("op").v; const right = parseMulDiv(); left = { type: "bin", op, left, right }; }
    return left;
  }
  function parseMulDiv() {
    let left = parsePower();
    while (isOp("*", "/")) { const op = eat("op").v; const right = parsePower(); left = { type: "bin", op, left, right }; }
    return left;
  }
  function parsePower() {
    let left = parseUnary();
    while (isOp("^")) { eat("op"); const right = parseUnary(); left = { type: "bin", op: "^", left, right }; }
    return left;
  }
  function parseUnary() {
    if (isOp("-", "+")) { const op = eat("op").v; const expr = parseUnary(); return { type: "unary", op, expr }; }
    return parsePostfix();
  }
  function parsePostfix() {
    const node = parsePrimary();
    if (isOp("%")) { eat("op"); return { type: "unary", op: "%", expr: node }; }
    return node;
  }
  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error("parse: EOF");
    if (tok.t === "num") { i++; return { type: "num", value: tok.v }; }
    if (tok.t === "str") { i++; return { type: "str", value: tok.v }; }
    if (tok.t === "bool") { i++; return { type: "bool", value: tok.v }; }
    if (tok.t === "lp") { i++; const e = parseExpr(); eat("rp"); return e; }
    if (tok.t === "fn") {
      i++;
      eat("lp");
      const args = [];
      if (peek() && peek().t !== "rp") {
        args.push(parseExpr());
        while (peek() && peek().t === "comma") { i++; args.push(parseExpr()); }
      }
      eat("rp");
      return { type: "call", name: tok.v, args };
    }
    if (tok.t === "ref") { i++; return { type: "ref", value: tok.v }; }
    if (tok.t === "range") { i++; return { type: "range", value: tok.v }; }
    if (tok.t === "id") {
      // unknown identifier (e.g. another sheet name) — treat as 0
      i++;
      return { type: "num", value: 0 };
    }
    throw new Error("parse: 알 수 없는 토큰 " + JSON.stringify(tok));
  }

  return parseExpr();
}

// ----- Evaluator -----
function _evalAst(node, ctx) {
  switch (node.type) {
    case "num": return node.value;
    case "str": return node.value;
    case "bool": return node.value;
    case "ref": {
      const p = _parseCellRef(node.value);
      if (!p) return "";
      return _readCell(ctx.sheet, p.r, p.c, ctx.results);
    }
    case "range": {
      const a = _parseCellRef(node.value.from);
      const b = _parseCellRef(node.value.to);
      if (!a || !b) return [];
      const r1 = Math.min(a.r, b.r), r2 = Math.max(a.r, b.r);
      const c1 = Math.min(a.c, b.c), c2 = Math.max(a.c, b.c);
      const out = [];
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) out.push(_readCell(ctx.sheet, r, c, ctx.results));
      }
      return out;
    }
    case "unary": {
      const v = _evalAst(node.expr, ctx);
      if (node.op === "-") return -Number(v || 0);
      if (node.op === "+") return Number(v || 0);
      if (node.op === "%") return Number(v || 0) / 100;
      return v;
    }
    case "bin": {
      const l = _evalAst(node.left, ctx);
      const r = _evalAst(node.right, ctx);
      return _applyOp(node.op, l, r);
    }
    case "call": {
      const fn = FORMULA_FN[node.name];
      if (!fn) return FORMULA_ERROR;
      const args = node.args.map(a => _evalAst(a, ctx));
      try { return fn(args); }
      catch (e) { return FORMULA_ERROR; }
    }
  }
  return "";
}

function _applyOp(op, l, r) {
  if (op === "&") return String(l ?? "") + String(r ?? "");
  if (op === "=") return _eq(l, r);
  if (op === "<>") return !_eq(l, r);
  const ln = Number(l) || 0;
  const rn = Number(r) || 0;
  if (op === "+") return ln + rn;
  if (op === "-") return ln - rn;
  if (op === "*") return ln * rn;
  if (op === "/") return rn === 0 ? FORMULA_ERROR : ln / rn;
  if (op === "^") return Math.pow(ln, rn);
  if (op === "<")  return _cmp(l, r) <  0;
  if (op === ">")  return _cmp(l, r) >  0;
  if (op === "<=") return _cmp(l, r) <= 0;
  if (op === ">=") return _cmp(l, r) >= 0;
  return FORMULA_ERROR;
}

function _eq(a, b) {
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a ?? "") === String(b ?? "");
}
function _cmp(a, b) {
  if (typeof a === "number" || typeof b === "number") {
    return (Number(a) || 0) - (Number(b) || 0);
  }
  return String(a ?? "").localeCompare(String(b ?? ""));
}

// 메인 진입점. results 는 다른 수식 셀의 평가 결과 맵 (의존 체인 해소용).
function evalFormula(formulaStr, sheet, position, results) {
  if (!formulaStr) return "";
  let s = String(formulaStr).trim();
  if (s.startsWith("=")) s = s.slice(1);
  if (s.indexOf("!") >= 0) return FORMULA_UNSUPPORTED;
  try {
    const tokens = _tokenize(s);
    if (tokens.length === 0) return "";
    const ast = _parser(tokens);
    return _evalAst(ast, { sheet, position: position || { r: 0, c: 0 }, results: results || null });
  } catch (err) {
    return FORMULA_UNSUPPORTED;
  }
}

// 시트 전체에서 등록된 수식들을 순회하며 결과 맵을 만든다.
// 수식이 다른 수식을 참조하는 의존 체인을 해소하기 위해 fixpoint 반복:
// 매 패스마다 결과 맵을 갱신하고, 더 이상 바뀌는 게 없으면 종료.
function recomputeSheetFormulas(sheetAoA, formulasMap, originalCachedValues) {
  if (!formulasMap) return null;
  const out = {};
  const addrs = Object.keys(formulasMap);
  if (addrs.length === 0) return out;

  const MAX_PASSES = 12; // 충분한 깊이 — 일반 워크북에서 5~6 패스면 안정
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    addrs.forEach(addr => {
      const ref = _parseCellRef(addr);
      if (!ref) return;
      const formula = formulasMap[addr];
      const result = evalFormula(formula, sheetAoA, ref, out);
      let nextVal;
      if (result === FORMULA_UNSUPPORTED) {
        // 평가 불가 — 원본 캐시 값 유지
        nextVal = (originalCachedValues && originalCachedValues[addr] !== undefined)
          ? originalCachedValues[addr] : "";
      } else {
        nextVal = result;
      }
      const prev = out[addr];
      if (!_sameVal(prev, nextVal)) {
        out[addr] = nextVal;
        changed = true;
      }
    });
    if (!changed) break;
  }
  return out;
}

function _sameVal(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    if (isNaN(a) && isNaN(b)) return true;
    return Math.abs(a - b) < 1e-9;
  }
  return String(a ?? "") === String(b ?? "");
}

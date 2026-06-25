const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "pipeline.js"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error("missing function " + name);
  const paramsEnd = src.indexOf(")", start);
  let i = src.indexOf("{", paramsEnd);
  if (i < 0) throw new Error("missing body " + name);
  let depth = 0;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unterminated " + name);
}

eval([
  extractFunction("shouldSkipRuntimeAutoRepairForStep"),
  "globalThis.H = { shouldSkipRuntimeAutoRepairForStep };",
].join("\n"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  H.shouldSkipRuntimeAutoRepairForStep({ trustedStatic: true }, { source: "runner" }) === true,
  "trusted saved steps must not auto-repair during runner full-run",
);
assert(
  H.shouldSkipRuntimeAutoRepairForStep({ trustedStatic: true }, { source: "generator" }) === true,
  "trusted saved steps must not auto-repair during generator full-run",
);
assert(
  H.shouldSkipRuntimeAutoRepairForStep({ trustedStatic: true }, { source: "runner-recovery" }) === false,
  "manual recovery must still be allowed for trusted steps",
);
assert(
  H.shouldSkipRuntimeAutoRepairForStep({ trustedStatic: true }, { source: "runner", allowTrustedRuntimeRepair: true }) === false,
  "explicit override must allow trusted runtime repair",
);
assert(
  H.shouldSkipRuntimeAutoRepairForStep({ trustedStatic: false }, { source: "runner" }) === false,
  "new untrusted generated steps may still use auto-repair",
);

console.log("pipeline trusted runtime repair gate OK");

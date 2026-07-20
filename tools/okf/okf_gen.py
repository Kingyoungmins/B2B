#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OKF(Open Knowledge Format) 생성기 — Python/JS/C# 다국어.

레포의 각 함수/메서드를 '입력·출력·역할·사이드이펙트·호출관계(calls/called_by/reads/writes)'로 구조화한
OKF 마크다운(함수 1개 = 문서 1개)과 전체 콜그래프 인덱스(_graph.json)를 코드에서 '자동 추출'한다.
정확한 것(시그니처·호출·전역 read/write)과 추정(역할·affects)을 명세에서 구분 표기한다.

추출 신뢰도:
  - Python: ast (정확)
  - JS/C#: 정규식(근사) — extraction: regex 로 표기(제안서 4절 허용). 관계/사이드이펙트는 best-effort.

사용:  python tools/okf/okf_gen.py <src...> --out docs/okf --version X
"""
import ast, sys, io, json, re, argparse
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── 사이드이펙트 정적 탐지 힌트 ──────────────────────────────────────────────
PY_COM = {"Range", "Cells", "Worksheets", "Workbooks", "Worksheet", "Application", "Selection",
          "ActiveSheet", "ActiveCell", "ActiveWorkbook", "Windows", "Select", "Copy",
          "PasteSpecial", "Activate", "Merge", "UnMerge", "Calculate", "RangeSelection"}
PY_FILE = {"open", "write_text", "write_bytes", "read_text", "read_bytes", "mkdir", "makedirs",
           "unlink", "remove", "rmtree", "copy", "copy2", "move", "rename", "SaveAs", "SaveCopyAs", "Save"}
PY_PROC = {"Popen", "run", "call", "check_output", "check_call", "system"}
PY_NET = {"urlopen", "Request", "socket", "sendall", "connect"}
JS_KEYWORDS = {"if", "for", "while", "switch", "catch", "return", "function", "typeof", "await",
               "new", "throw", "else", "do", "in", "of", "case", "delete", "void", "yield", "super"}
CS_KEYWORDS = {"if", "for", "foreach", "while", "switch", "catch", "using", "lock", "return", "new",
               "throw", "else", "do", "fixed", "unsafe", "checked", "unchecked"}


def read_source(path):
    return Path(path).read_text(encoding="utf-8-sig")  # BOM 안전


def leading_comment(src_lines, first_line, markers=("#",)):
    """def/함수 선언 바로 위의 연속 주석 블록에서 역할 한 줄."""
    i = first_line - 2
    out = []
    while i >= 0:
        s = src_lines[i].strip()
        if any(s.startswith(m) for m in markers):
            for m in markers:
                if s.startswith(m):
                    out.append(s[len(m):].strip().lstrip("*/ ").strip())
                    break
            i -= 1
        elif s.endswith("*/") or s.startswith("*"):  # 블록주석 꼬리
            out.append(s.strip("*/ ").strip()); i -= 1
        else:
            break
    out = [x for x in reversed(out) if x]
    return out[0] if out else ""


def brace_body(text, open_idx):
    """open_idx('{' 위치)부터 매칭 '}' 까지 본문 문자열."""
    depth = 0
    for j in range(open_idx, len(text)):
        c = text[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[open_idx:j + 1]
    return text[open_idx:]


# ── Python (ast) ────────────────────────────────────────────────────────────
def _call_name(call):
    f = call.func
    if isinstance(f, ast.Name):
        return f.id
    if isinstance(f, ast.Attribute):
        return f.attr
    return None


def extract_python(path):
    text = read_source(path)
    tree = ast.parse(text)
    src_lines = text.splitlines()
    module = Path(path).name
    mg = set()
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    mg.add(t.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            mg.add(node.target.id)

    funcs = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            funcs.append((None, node))
        elif isinstance(node, ast.ClassDef):
            for m in node.body:
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    funcs.append((node.name, m))

    recs = []
    for cls, node in funcs:
        raw_calls, raw_argrefs, reads, writes, se, raises = set(), set(), set(), set(), set(), []
        for n in ast.walk(node):
            if isinstance(n, ast.Global):
                writes.update(set(n.names) & mg)
            elif isinstance(n, ast.Call):
                cn = _call_name(n)
                if cn:
                    raw_calls.add(cn)
                    if cn in PY_FILE: se.add("파일시스템 변경/IO")
                    if cn in PY_PROC: se.add("서브프로세스/OS 호출")
                    if cn in PY_COM: se.add("Excel COM 조작(파괴적일 수 있음)")
                    if cn in PY_NET: se.add("네트워크 호출")
                for a in list(n.args) + [k.value for k in n.keywords]:
                    if isinstance(a, ast.Name):
                        raw_argrefs.add(a.id)  # 디스패치/콜백: excel_call(fn,..)
            elif isinstance(n, ast.Attribute) and n.attr in PY_COM:
                se.add("Excel COM 조작(파괴적일 수 있음)")
            elif isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load) and n.id in mg:
                reads.add(n.id)
            elif isinstance(n, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
                tgts = n.targets if isinstance(n, ast.Assign) else [n.target]
                for t in tgts:
                    if isinstance(t, ast.Name) and t.id in mg:
                        writes.add(t.id)
                    elif isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name) and t.value.id in mg:
                        writes.add(t.value.id)
                    elif isinstance(t, ast.Attribute) and isinstance(t.value, ast.Name) and t.value.id == "self":
                        writes.add("self." + t.attr)
            elif isinstance(n, ast.Raise):
                ex = n.exc
                nm = _call_name(ex) if isinstance(ex, ast.Call) else (ex.id if isinstance(ex, ast.Name) else None)
                if nm: raises.append(nm)
            elif isinstance(n, ast.Attribute) and isinstance(n.ctx, ast.Load) \
                    and isinstance(n.value, ast.Name) and n.value.id == "self":
                reads.add("self." + n.attr)
        if writes: se.add("상태 변경(전역/세션): " + ", ".join(sorted(writes)))
        if "EXCEL_LOCK" in reads or "EXCEL_LOCK" in raw_calls: se.add("EXCEL_LOCK 직렬화")
        se.discard("")
        doc = ast.get_docstring(node)
        role = doc.strip().splitlines()[0].strip() if doc else leading_comment(src_lines, node.lineno)
        args = ast.unparse(node.args)
        ret = f" -> {ast.unparse(node.returns)}" if node.returns else ""
        inputs = []
        a = node.args
        for arg in list(a.posonlyargs) + list(a.args) + list(a.kwonlyargs):
            ann = ast.unparse(arg.annotation) if arg.annotation else ""
            inputs.append(f"{arg.arg}: {ann}" if ann else arg.arg)
        if a.vararg: inputs.append("*" + a.vararg.arg)
        if a.kwarg: inputs.append("**" + a.kwarg.arg)
        recs.append({
            "module": module, "lang": "python", "extraction": "ast", "cls": cls or "",
            "name": node.name, "qual": (cls + "." + node.name) if cls else node.name,
            "signature": f"({args}){ret}", "role": role,
            "role_source": "docstring" if doc else ("banner" if role else "none"),
            "lineno": node.lineno, "end": node.end_lineno,
            "inputs": inputs, "returns": ast.unparse(node.returns) if node.returns else "(추정)",
            "raw_calls": raw_calls | raw_argrefs, "reads": sorted(reads),
            "writes": sorted(writes), "side_effects": sorted(se) or ["없음(정적 분석 기준)"],
            "raises": sorted(set(raises)),
        })
    return recs


# ── JS (정규식, 근사) ────────────────────────────────────────────────────────
JS_DECL = re.compile(
    r"(?:^|\n)[ \t]*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|"
    r"(?:^|\n)[ \t]*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*)?\(([^)]*)\)\s*(?:=>|\{)"
)
JS_CALL = re.compile(r"([A-Za-z_$][\w$]*)\s*\(")


def extract_js(path):
    text = read_source(path)
    src_lines = text.splitlines()
    module = Path(path).name
    recs = []
    for m in JS_DECL.finditer(text):
        name = m.group(1) or m.group(3)
        params = (m.group(2) or m.group(4) or "").strip()
        if not name:
            continue
        line_no = text.count("\n", 0, m.start()) + (1 if text[m.start()] != "\n" else 2)
        line_no = text.count("\n", 0, m.start() + 1) + 1
        brace = text.find("{", m.end() - 1)
        body = brace_body(text, brace) if brace != -1 and brace - m.end() < 3 else ""
        raw_calls = {c for c in JS_CALL.findall(body) if c not in JS_KEYWORDS}
        se = set()
        if re.search(r"\b(localStorage|sessionStorage)\b", body): se.add("localStorage/세션스토리지 접근")
        if re.search(r"\b(document|window)\.|\.innerHTML|addEventListener", body): se.add("DOM/브라우저 전역 조작")
        if re.search(r"\bfetch\(|XMLHttpRequest|postExcelMirror\(|postJSON\(|apiPost\(", body): se.add("네트워크/서버 호출")
        if re.search(r"\bsetTimeout\(|setInterval\(", body): se.add("타이머")
        writes = sorted(set(re.findall(r"\bstate\.(\w+)\s*=", body)) |
                        set("excelMirror." + x for x in re.findall(r"\bexcelMirror\.(\w+)\s*=", body)))
        reads = sorted(set("state." + x for x in re.findall(r"\bstate\.(\w+)\b", body)))[:20]
        if writes: se.add("상태 변경: " + ", ".join(writes))
        role = leading_comment(src_lines, line_no, markers=("//",))
        recs.append({
            "module": module, "lang": "js", "extraction": "regex", "cls": "",
            "name": name, "qual": name, "signature": f"({params})", "role": role,
            "role_source": "banner" if role else "none", "lineno": line_no, "end": line_no,
            "inputs": [p.strip() for p in params.split(",") if p.strip()], "returns": "(추정)",
            "raw_calls": raw_calls, "reads": reads, "writes": writes,
            "side_effects": sorted(se) or ["없음(정적 분석 기준)"], "raises": [],
        })
    return recs


# ── C# (정규식, 근사) ────────────────────────────────────────────────────────
CS_DECL = re.compile(
    r"(?:public|private|protected|internal|static|async|override|virtual|sealed|partial|\s){2,}"
    r"[\w<>\[\],.?]+\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{")
CS_CALL = re.compile(r"([A-Za-z_]\w*)\s*\(")


def extract_csharp(path):
    text = read_source(path)
    src_lines = text.splitlines()
    module = Path(path).name
    recs = []
    for m in CS_DECL.finditer(text):
        name, params = m.group(1), m.group(2).strip()
        if name in CS_KEYWORDS:
            continue
        line_no = text.count("\n", 0, m.start() + 1) + 1
        brace = text.rfind("{", m.start(), m.end())
        body = brace_body(text, brace) if brace != -1 else ""
        raw_calls = {c for c in CS_CALL.findall(body) if c not in CS_KEYWORDS}
        se = set()
        if re.search(r"\b(File|Directory)\.|StreamWriter|StreamReader", body): se.add("파일시스템 변경/IO")
        if re.search(r"\b(Process)\.|new\s+Process|\.Start\(|\.Kill\(", body): se.add("프로세스 실행/종료")
        if re.search(r"\bRegistry", body): se.add("레지스트리 접근")
        if re.search(r"WebView2|CoreWebView2|ExecuteScript", body): se.add("WebView2 조작")
        role = leading_comment(src_lines, line_no, markers=("///", "//"))
        recs.append({
            "module": module, "lang": "csharp", "extraction": "regex", "cls": "",
            "name": name, "qual": name, "signature": f"({params})", "role": role,
            "role_source": "xmldoc/banner" if role else "none", "lineno": line_no, "end": line_no,
            "inputs": [p.strip() for p in params.split(",") if p.strip()], "returns": "(추정)",
            "raw_calls": raw_calls, "reads": [], "writes": [],
            "side_effects": sorted(se) or ["없음(정적 분석 기준)"], "raises": [],
        })
    return recs


# ── 방출 ──────────────────────────────────────────────────────────────────────
def yaml_list(items):
    if not items:
        return " []"
    return "\n" + "\n".join(f"  - {json.dumps(x, ensure_ascii=False)}" for x in items)


def build_md(rec, version):
    role = rec["role"]
    inferred = not role
    if inferred:
        role = "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"
    fm = ["---",
          "type: " + ("method" if rec["cls"] else ("endpoint" if rec["lang"] != "python" else "function")),
          "title: " + rec["qual"],
          "module: " + rec["module"],
          "lang: " + rec["lang"],
          "extraction: " + rec["extraction"] + ("   # 정규식 근사" if rec["extraction"] == "regex" else ""),
          ]
    if rec["cls"]:
        fm.append("class: " + rec["cls"])
    fm += [
        "signature: " + json.dumps(rec["signature"], ensure_ascii=False),
        "role: " + json.dumps(role, ensure_ascii=False) + ("   # (추정)" if inferred else ""),
        "role_source: " + rec["role_source"],
        "version: " + json.dumps(version, ensure_ascii=False),
        f"loc: \"{rec['module']}:{rec['lineno']}-{rec['end']}\"",
        "",
        "# ── 입출력 ──",
        "inputs:" + yaml_list(rec["inputs"]),
        "returns: " + json.dumps(rec["returns"], ensure_ascii=False),
        "",
        "# ── 사이드이펙트 (정적 추정) ──",
        "side_effects:" + yaml_list(rec["side_effects"]),
        "raises:" + yaml_list(rec["raises"]),
        "",
        "# ── 유기적 관계 ──",
        "calls:" + yaml_list(rec["calls"]),
        "calls_external:" + yaml_list(rec["calls_ext"]),
        "called_by:" + yaml_list(rec["called_by"]),
        "reads:" + yaml_list(rec["reads"]),
        "writes:" + yaml_list(rec["writes"]),
        "affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능",
        "timestamp: " + json.dumps(version + "-gen", ensure_ascii=False),
        "---"]
    body = ["", "## 역할", role + ("  _(자동 추정 — 확인 필요)_" if inferred else ""), "",
            "## 사이드이펙트 & 주의"]
    body += [f"- {s}" for s in rec["side_effects"]]
    if rec["writes"]:
        body.append(f"- 변경 상태 `{', '.join(rec['writes'])}` — 수정 시 이 상태를 읽는 곳 동반 점검.")
    body += ["", "## 관계",
             "- 호출: " + (", ".join(f"`{c}`" for c in rec["calls"]) or "없음"),
             "- 피호출(영향 전파 경로): " + (", ".join(f"`{c}`" for c in rec["called_by"]) or "없음"),
             "", "## 실패/예외"]
    body += [f"- `{r}`" for r in (rec["raises"] or ["(명시적 raise 없음/미탐지)"])]
    return "\n".join(fm) + "\n" + "\n".join(body) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="+")
    ap.add_argument("--out", default="docs/okf")
    ap.add_argument("--version", default="0.0.0")
    args = ap.parse_args()

    all_recs = []
    for src in args.sources:
        ext = Path(src).suffix.lower()
        try:
            if ext == ".py":
                all_recs += extract_python(src)
            elif ext in (".js",):
                all_recs += extract_js(src)
            elif ext in (".cs",):
                all_recs += extract_csharp(src)
        except Exception as e:
            print(f"[WARN] {src} 추출 실패: {e}")

    # 2패스: 언어별 defined 집합으로 내부/외부 호출 분리 + called_by 역방향
    defined_by_lang = {}
    for r in all_recs:
        defined_by_lang.setdefault(r["lang"], set()).add(r["name"])
    called_by = {}  # (lang, name) -> set(caller qual)
    for r in all_recs:
        dn = defined_by_lang[r["lang"]]
        r["calls"] = sorted(c for c in r["raw_calls"] if c in dn and c != r["name"])
        r["calls_ext"] = sorted(c for c in r["raw_calls"] if c not in dn)[:40]
        for c in r["calls"]:
            called_by.setdefault((r["lang"], c), set()).add(r["qual"])
    for r in all_recs:
        r["called_by"] = sorted(called_by.get((r["lang"], r["name"]), set()) - {r["qual"]})

    out_root = Path(args.out)
    seen = set()
    nodes, edges = [], []
    for r in all_recs:
        mod_dir = out_root / Path(r["module"]).stem
        mod_dir.mkdir(parents=True, exist_ok=True)
        base = re.sub(r"[^\w.\-]", "_", r["qual"])
        fn = base + ".md"
        if (r["module"], fn) in seen:
            fn = f"{base}__L{r['lineno']}.md"
        seen.add((r["module"], fn))
        (mod_dir / fn).write_text(build_md(r, args.version), encoding="utf-8")
        nodes.append({"id": r["qual"], "module": r["module"], "lang": r["lang"],
                      "kind": "method" if r["cls"] else "function", "extraction": r["extraction"],
                      "loc": f"{r['module']}:{r['lineno']}-{r['end']}", "signature": r["signature"],
                      "calls": r["calls"], "side_effects": r["side_effects"],
                      "reads": r["reads"], "writes": r["writes"]})
        for c in r["calls"]:
            edges.append({"from": r["qual"], "to": c, "lang": r["lang"]})

    graph = {"version": args.version, "nodes": nodes, "edges": edges,
             "stats": {"functions": len(nodes), "edges": len(edges),
                       "by_lang": {k: len(v) for k, v in defined_by_lang.items()}}}
    out_root.mkdir(parents=True, exist_ok=True)
    (out_root / "_graph.json").write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OKF: {len(nodes)}개 문서 + _graph.json (edges={len(edges)}, by_lang={graph['stats']['by_lang']})")
    print(f"출력: {out_root}")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""버튼 → 엔드포인트 → 실제 실행 함수. 호출 경로를 '기계가' 따라간다.

왜 있나(2026-08-26):
  이어실행을 고치고 단위 테스트까지 통과시킨 뒤 "[전체실행]을 다시 누르면 앞 단계를 건너뜁니다"라고
  안내했는데, 그 resume 은 /api/pipeline/start 경로에만 있었고 실행기 [전체실행]이 타는
  _run_full_pipeline_single_instance_impl 에는 아예 없었다. 함수만 보고 '누르는 버튼에서 거기까지
  닿는지'를 확인하지 않은 탓이다. 그 확인을 사람 기억에 맡기지 않고 명령 한 줄로 만든다.

  ※ OKF 그래프(_graph.json)에는 클래스 메서드(handle_* 핸들러)가 없다 — 그래서 여기서 직접 AST 를 판다.

사용법
  python tools/callpath/trace.py --reaches _run_full_pipeline_single_instance_impl
      → 이 함수에 닿는 엔드포인트 / 그 엔드포인트를 부르는 클라 함수 / 그 함수가 만지는 버튼 id
  python tools/callpath/trace.py --endpoint /api/excel/run-full-pipeline [--depth 6]
      → 그 엔드포인트가 실제로 도달하는 백엔드 함수들
  python tools/callpath/trace.py --button runner-run-btn
      → 그 버튼에서 출발해 닿는 엔드포인트와 백엔드 함수
  python tools/callpath/trace.py --assert "runner-run-btn -> _run_full_pipeline_single_instance_impl"
      → 닿으면 exit 0, 안 닿으면 경로를 찍고 exit 1 (회귀 테스트/주장 검증용)
"""
import argparse
import ast
import json
import re
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND = ROOT / "serve_b2b.py"
SCRIPT_DIRS = [ROOT / "scripts"]


# ---------------------------------------------------------------- python 쪽

def build_python_graph(path=BACKEND):
    """호출 그래프를 '이름'이 아니라 '정의 위치'로 만든다.

    이름으로 합치면 안 되는 이유(이 도구의 첫 판이 실제로 틀렸다):
      worker 는 4번 정의된다 — Excel 큐 펌프(ensure_excel_worker 안), PPTX 렌더러 안,
      백엔드 파이프라인 핸들러 안, VBA 디버그 억제기 안. 이름으로 합치면 상관없는 넷이 한 노드가 되어
      '전체실행 버튼 → capture-copypaste → excel_call → worker → (아무 함수) → 백그라운드 resume'
      같은 있지도 않은 경로가 생긴다. 실제로 그 탓에 내 거짓 주장을 OK 라고 판정했다.

    해석 규칙(파이썬 스코프 그대로):
      - 이름 N 을 스코프 S 안에서 부르면, S 의 조상 중 N 을 자식으로 가진 가장 가까운 스코프의 것.
      - 없으면 모듈 최상위 정의. 모듈에 같은 이름이 둘이면 '나중 것'이 이긴다(파이썬이 그렇다:
        run_backend_pipeline_payload 는 20580 과 22106 두 번 정의돼 뒤엣것만 살아있다).
      - 못 찾으면 간선 없음(큐에서 꺼낸 fn(...) 같은 건 호출로 안 센다 — 스레드 경계지 호출이 아니다).

    반환: calls(qual→set(qual)), meta(qual→{name, line, scope}), tree, index(name→[qual…])
    """
    src = path.read_text(encoding="utf-8-sig")
    tree = ast.parse(src)

    children = {"": {}}      # 스코프 qual -> {자식이름: 자식 qual}
    parent = {"": None}
    meta = {}
    raw = {}                 # qual -> [(호출이름, 그 호출이 일어난 스코프 qual)]

    def qual_of(scope, name):
        return (scope + "." + name) if scope else name

    class Collect(ast.NodeVisitor):
        def __init__(self):
            self.scope = ""

        def _enter(self, node, kind):
            q = qual_of(self.scope, node.name)
            children.setdefault(self.scope, {})[node.name] = q   # 같은 이름이면 나중 것이 이긴다
            children.setdefault(q, {})
            parent[q] = self.scope
            meta[q] = {"name": node.name, "line": node.lineno, "kind": kind, "scope": self.scope}
            raw.setdefault(q, [])
            prev, self.scope = self.scope, q
            self.generic_visit(node)
            self.scope = prev

        def visit_FunctionDef(self, node):
            self._enter(node, "def")

        def visit_AsyncFunctionDef(self, node):
            self._enter(node, "def")

        def visit_ClassDef(self, node):
            self._enter(node, "class")

        def visit_Call(self, node):
            f = node.func
            name = getattr(f, "id", None) or getattr(f, "attr", None)
            if name and self.scope:
                raw[self.scope].append(name)
            self.generic_visit(node)

        def visit_Name(self, node):
            # 함수를 '넘기는' 것도 실행이다: excel_call(_run_..._impl, …) / Thread(target=fn).
            # 이걸 안 세면 실행기 전체실행 경로가 통째로 안 보인다.
            if self.scope and isinstance(node.ctx, ast.Load):
                raw[self.scope].append(node.id)
            self.generic_visit(node)

    Collect().visit(tree)

    def resolve(name, scope):
        s = scope
        while s is not None:
            got = children.get(s, {}).get(name)
            if got:
                return got
            s = parent.get(s)
        return children.get("", {}).get(name)

    calls = {q: set() for q in meta}
    for q, names in raw.items():
        for n in set(names):
            tgt = resolve(n, q)
            if tgt and tgt != q:
                calls[q].add(tgt)

    index = {}
    for q, m in meta.items():
        index.setdefault(m["name"], []).append(q)
    return calls, meta, tree, index


def pick(index, name, meta):
    """사용자가 준 짧은 이름 -> qual. 여러 개면 모듈 최상위 것을 먼저, 그 다음 마지막 정의."""
    cands = index.get(name) or []
    if not cands:
        return None, []
    top = [q for q in cands if not meta[q]["scope"]]
    if top:
        return top[-1], cands
    return sorted(cands, key=lambda q: meta[q]["line"])[-1], cands


def short(meta, q):
    return meta[q]["name"] if q in meta else q


def build_endpoint_map(tree):
    """`if self.path == "/api/x": self.handle_y()` 형태의 라우팅을 뽑는다.
    == 와 startswith 둘 다 쓰이므로 둘 다 본다."""
    routes = {}

    def path_literals(test):
        out = []
        if isinstance(test, ast.Compare) and isinstance(test.left, ast.Attribute) \
                and test.left.attr == "path":
            for c in test.comparators:
                if isinstance(c, ast.Constant) and isinstance(c.value, str):
                    out.append(c.value)
        if isinstance(test, ast.Call) and isinstance(test.func, ast.Attribute) \
                and test.func.attr in ("startswith", "endswith"):
            owner = test.func.value
            if isinstance(owner, ast.Attribute) and owner.attr == "path":
                for a in test.args:
                    if isinstance(a, ast.Constant) and isinstance(a.value, str):
                        out.append(a.value)
                    elif isinstance(a, (ast.Tuple, ast.List)):
                        for e in a.elts:
                            if isinstance(e, ast.Constant) and isinstance(e.value, str):
                                out.append(e.value)
        if isinstance(test, ast.BoolOp):
            for v in test.values:
                out.extend(path_literals(v))
        return out

    routes_raw = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.If):
            continue
        paths = path_literals(node.test)
        if not paths:
            continue
        handlers = []
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call):
                f = sub.func
                name = getattr(f, "attr", None) or getattr(f, "id", None)
                if name and name.startswith("handle_"):
                    handlers.append(name)
        for p in paths:
            routes_raw.setdefault(p, [])
            for h in handlers:
                if h not in routes_raw[p]:
                    routes_raw[p].append(h)
    for k, v in routes_raw.items():
        if v:
            routes[k] = v
    return routes


def handler_quals(index, meta, name):
    """핸들러는 B2BHandler 의 메서드다 — 짧은 이름으로 들어오므로 후보를 전부 돌려준다."""
    return index.get(name) or []
def reachable(calls, start, depth=8):
    """start 에서 도달 가능한 이름들 + 각각의 최단 경로."""
    seen = {start: [start]}
    q = deque([(start, 0)])
    while q:
        cur, d = q.popleft()
        if d >= depth:
            continue
        for nxt in sorted(calls.get(cur, ())):
            if nxt in seen:
                continue
            seen[nxt] = seen[cur] + [nxt]
            q.append((nxt, d + 1))
    return seen


# -------------------------------------------------------------------- js 쪽

FN_RE = re.compile(r"(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(")
CALL_RE = re.compile(r"([A-Za-z_$][\w$]*)\s*\(")
API_RE = re.compile(r"[\"'`](/api/[^\"'`\s]*)[\"'`]")
ID_RE = re.compile(r"[\"'#]([a-z][a-z0-9-]{2,})[\"'\s]")


def _fn_bodies(src):
    """중괄호 짝을 세어 함수 본문을 자른다(문자열/주석 안의 괄호는 무시)."""
    out = {}
    for m in FN_RE.finditer(src):
        name = m.group(1)
        i = src.find("{", m.end())
        if i < 0:
            continue
        depth, j, n = 0, i, len(src)
        in_s, esc, in_c = "", False, ""
        while j < n:
            ch = src[j]
            if in_c:
                if in_c == "//" and ch == "\n":
                    in_c = ""
                elif in_c == "/*" and ch == "*" and src[j + 1:j + 2] == "/":
                    in_c, j = "", j + 1
            elif in_s:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == in_s:
                    in_s = ""
            elif ch in "\"'`":
                in_s = ch
            elif ch == "/" and src[j + 1:j + 2] in ("/", "*"):
                in_c = "/" + src[j + 1]
                j += 1
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    out.setdefault(name, "")
                    out[name] += src[i:j + 1]
                    break
            j += 1
    return out


def _match_block(src, i):
    """src[i] 위치 이후 첫 '{' 부터 짝이 맞는 '}' 까지."""
    i = src.find("{", i)
    if i < 0:
        return ""
    depth, j, n = 0, i, len(src)
    in_s, esc, in_c = "", False, ""
    while j < n:
        ch = src[j]
        if in_c:
            if in_c == "//" and ch == chr(10):
                in_c = ""
            elif in_c == "/*" and ch == "*" and src[j + 1:j + 2] == "/":
                in_c, j = "", j + 1
        elif in_s:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == in_s:
                in_s = ""
        elif ch in "\"'`":
            in_s = ch
        elif ch == "/" and src[j + 1:j + 2] in ("/", "*"):
            in_c = "/" + src[j + 1]
            j += 1
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
        j += 1
    return src[i:]


def js_button_handlers(button_id):
    """버튼 id 에 '실제로 묶인' 클릭 핸들러 본문만 뽑는다.
    화살표 함수로 바로 붙이는 형태($("id").onclick = () => {…})가 많아, 이름 있는 function 만
    보면 통째로 놓친다 — 그러면 '그 버튼은 아무 것도 안 한다'는 거짓 결론이 난다."""
    Q = "[\"']"                     # 따옴표 아무거나
    pats = [
        r"\$\(\s*" + Q + r"%s" + Q + r"\s*\)\s*\.\s*onclick\s*=",
        r"getElementById\(\s*" + Q + r"%s" + Q + r"\s*\)\s*\.\s*onclick\s*=",
        r"(?:\$|getElementById)\(\s*" + Q + r"%s" + Q + r"\s*\)[\s\S]{0,80}?addEventListener\(\s*" + Q + r"click" + Q,
        r"querySelector\(\s*" + Q + r"#%s" + Q + r"\s*\)[\s\S]{0,80}?addEventListener\(\s*" + Q + r"click" + Q,
    ]
    out = []
    for d in SCRIPT_DIRS:
        for f in sorted(d.glob("*.js")):
            src = f.read_text(encoding="utf-8", errors="replace").replace("﻿", "")
            for pat in pats:
                for m in re.finditer(pat % re.escape(button_id), src):
                    body = _match_block(src, m.end())
                    if body:
                        out.append((f.name, body))
    return out


def build_js_index():
    """클라 함수 -> {calls, endpoints, ids}. 파일 전체(함수 밖 최상위 코드)도 __toplevel__ 로 담는다."""
    idx = {}
    for d in SCRIPT_DIRS:
        for f in sorted(d.glob("*.js")):
            src = f.read_text(encoding="utf-8", errors="replace").replace("﻿", "")
            bodies = _fn_bodies(src)
            covered = sum(len(b) for b in bodies.values())
            for name, body in bodies.items():
                e = idx.setdefault(name, {"calls": set(), "endpoints": set(), "ids": set(), "files": set()})
                e["calls"].update(CALL_RE.findall(body))
                e["endpoints"].update(API_RE.findall(body))
                e["ids"].update(ID_RE.findall(body))
                e["files"].add(f.name)
            if covered < len(src):   # 함수 밖 코드(이벤트 바인딩이 여기 많다)
                e = idx.setdefault("__toplevel__:" + f.name,
                                   {"calls": set(), "endpoints": set(), "ids": set(), "files": {f.name}})
                e["calls"].update(CALL_RE.findall(src))
                e["endpoints"].update(API_RE.findall(src))
                e["ids"].update(ID_RE.findall(src))
    return idx


def js_reach(idx, start, depth=6):
    """엔드포인트를 '몇 홉 떨어져 있는지'와 함께 돌려준다.
    클라는 공용 헬퍼가 서로를 많이 불러서, 홉 수 없이 합치면 버튼 하나가 모든 API 에 닿는 것처럼
    보인다(= 쓸모없는 과대추정). 가까운 것부터 보여줘야 읽을 수 있다."""
    seen = {start: 0}
    q = deque([(start, 0)])
    eps, files = {}, set()
    while q:
        cur, d = q.popleft()
        node = idx.get(cur)
        if not node:
            continue
        for ep in node["endpoints"]:
            if ep not in eps or d < eps[ep]:
                eps[ep] = d
        files.update(node["files"])
        if d >= depth:
            continue
        for nxt in sorted(node["calls"]):
            if nxt not in seen and nxt in idx:
                seen[nxt] = d + 1
                q.append((nxt, d + 1))
    return eps, set(seen), files


def js_entries_for_id(idx, button_id):
    return sorted(n for n, e in idx.items() if button_id in e["ids"])


def js_callers_of_endpoint(idx, endpoint):
    direct = sorted(n for n, e in idx.items() if endpoint in e["endpoints"])
    if not direct:
        return []
    # 그 함수를 부르는 상위 함수까지 한 겹 넓혀 '어느 화면에서'를 보이게 한다
    up = set(direct)
    for _ in range(3):
        add = {n for n, e in idx.items() if e["calls"] & up}
        if add <= up:
            break
        up |= add
    return sorted(up)


# ------------------------------------------------------------------ 명령들

def _load():
    calls, meta, tree, index = build_python_graph()
    return calls, meta, tree, index, build_endpoint_map(tree), build_js_index()


def _path_str(meta, path):
    return " → ".join(short(meta, q) for q in path)


def _endpoints_from_button(idx, bid, depth):
    """버튼 → 엔드포인트(홉수 포함). 홉 0 = onclick 본문에 직접 쓰인 것."""
    eps = {}

    def add(ep, hop):
        if ep not in eps or hop < eps[ep]:
            eps[ep] = hop

    handlers = js_button_handlers(bid)
    for _f, body in handlers:
        for ep in API_RE.findall(body):
            add(ep, 0)
        for c in sorted(set(CALL_RE.findall(body))):
            if c in idx:
                got, _, _ = js_reach(idx, c, depth)
                for ep, hop in got.items():
                    add(ep, hop + 1)
    if not handlers:
        for e in js_entries_for_id(idx, bid):
            got, _, _ = js_reach(idx, e, depth)
            for ep, hop in got.items():
                add(ep, hop + 1)
    return eps, handlers


def _backend_paths_to(calls, meta, index, routes, ep, target_q, depth):
    """엔드포인트 ep 의 핸들러들에서 target_q 까지의 경로(있으면)."""
    out = []
    for h in routes.get(ep) or []:
        for hq in handler_quals(index, meta, h):
            seen = reachable(calls, hq, depth)
            if target_q in seen:
                out.append((h, seen[target_q]))
    return out


def cmd_reaches(target, depth):
    calls, meta, tree, index, routes, idx = _load()
    tq, cands = pick(index, target, meta)
    if not tq:
        print("그런 함수가 serve_b2b.py 에 없다: %s" % target)
        return 2
    print("=== %s 에 닿는 경로 ===" % target)
    print("정의: serve_b2b.py:%d%s" % (meta[tq]["line"],
          ("   (같은 이름 %d곳 — 이것을 골랐다)" % len(cands)) if len(cands) > 1 else ""))
    hits = []
    for ep in sorted(routes):
        got = _backend_paths_to(calls, meta, index, routes, ep, tq, depth)
        for h, path in got:
            hits.append((ep, h, path))
    if not hits:
        print("  (없음) — 어떤 엔드포인트에서도 안 닿는다.")
        print("  → 죽은 코드이거나, 네가 고친 곳이 사용자가 누르는 그 화면이 아니다.")
        return 1
    for ep, h, path in hits:
        print("")
        print("  %s  →  %s()" % (ep, h))
        print("     " + _path_str(meta, path))
        callers = js_callers_of_endpoint(idx, ep)
        if callers:
            print("     클라: " + ", ".join(callers[:5]) + (" …" if len(callers) > 5 else ""))
    return 0


def cmd_endpoint(ep, depth):
    calls, meta, tree, index, routes, idx = _load()
    handlers = routes.get(ep)
    if not handlers:
        near = [k for k in routes if ep.rstrip("/") in k or k in ep]
        print("그런 엔드포인트가 없다: %s%s" % (ep, ("  (비슷한 것: %s)" % ", ".join(near[:5])) if near else ""))
        return 2
    print("=== %s ===" % ep)
    for h in handlers:
        for hq in handler_quals(index, meta, h):
            seen = reachable(calls, hq, depth)
            impls = sorted((q for q in seen if meta[q]["name"].startswith(("_run_", "run_"))),
                           key=lambda q: meta[q]["name"])
            print("  핸들러: %s()  serve_b2b.py:%d" % (h, meta[hq]["line"]))
            print("  도달 함수 %d개 / 실행 계열 %d개:" % (len(seen), len(impls)))
            for q in impls:
                print("     %-46s %s" % (meta[q]["name"], _path_str(meta, seen[q][1:])))
    return 0


def cmd_button(bid, depth):
    calls, meta, tree, index, routes, idx = _load()
    eps, handlers = _endpoints_from_button(idx, bid, depth)
    if not eps and not handlers:
        print("그 id 를 만지는 클라 코드가 없다: %s" % bid)
        return 2
    print("=== 버튼 #%s  (클라 추적 깊이 %d) ===" % (bid, depth))
    print("  진입: " + (", ".join("%s(onclick)" % f for f, _ in handlers) or "(직접 바인딩 못 찾음)"))
    for ep, hop in sorted(eps.items(), key=lambda kv: (kv[1], kv[0])):
        hs = routes.get(ep) or []
        print("  [%s] %s → %s" % ("직접" if hop == 0 else "%d홉" % hop, ep,
                                  ", ".join(h + "()" for h in hs) or "(라우팅 못 찾음)"))
        if hop > 1:
            continue   # 멀리 있는 건 이름만 — 공용 헬퍼 때문에 금세 전부에 닿는다
        for h in hs:
            for hq in handler_quals(index, meta, h):
                seen = reachable(calls, hq, depth + 4)
                for q in sorted((x for x in seen if meta[x]["name"].startswith(("_run_", "run_"))),
                                key=lambda x: meta[x]["name"])[:8]:
                    print("       %s" % meta[q]["name"])
    return 0


def cmd_assert(expr, depth):
    """'버튼 -> 함수' 또는 '/api/경로 -> 함수' 가 실제로 닿는지.
    exit 0 = 닿는다 / 1 = 안 닿는다 / 2 = 이름을 못 찾음."""
    if "->" not in expr:
        print("형식: '<버튼id 또는 /api/경로> -> <백엔드 함수>'")
        return 2
    left, right = [s.strip() for s in expr.split("->", 1)]
    calls, meta, tree, index, routes, idx = _load()
    tq, cands = pick(index, right, meta)
    if not tq:
        print("그런 함수가 serve_b2b.py 에 없다: %s" % right)
        return 2
    if left.startswith("/api/"):
        eps = {left: 0}
    else:
        eps, _h = _endpoints_from_button(idx, left, depth)
        if not eps:
            print("실패  버튼 %s 에서 백엔드 호출을 못 찾았다." % left)
            return 1
    best = None
    for ep, hop in sorted(eps.items(), key=lambda kv: kv[1]):
        for h, path in _backend_paths_to(calls, meta, index, routes, ep, tq, depth + 4):
            if best is None or hop < best[0]:
                best = (hop, ep, h, path)
    if best:
        hop, ep, h, path = best
        lead = ep if left == ep else ("%s → %s" % (left, ep))
        print("OK  %s → %s" % (lead, _path_str(meta, path)))
        if hop > 2:
            print("    (클라에서 %d홉 — 공용 헬퍼를 거친다. 이 엔드포인트가 정말 그 버튼의 것인지 눈으로 확인)" % hop)
        return 0
    print("실패  %s 에서 %s 로 가는 경로가 없다." % (left, right))
    print("      확인한 엔드포인트 %d개%s" % (len(eps),
          (": " + ", ".join(sorted(eps)[:12]) + (" …" if len(eps) > 12 else "")) if eps else ""))
    if len(cands) > 1:
        print("      (같은 이름이 %d곳에 있다 — 다른 것을 뜻했다면 --reaches 로 확인)" % len(cands))
    return 1


def main():
    ap = argparse.ArgumentParser(description="버튼→엔드포인트→실행함수 호출 경로 추적")
    ap.add_argument("--reaches", help="이 백엔드 함수에 닿는 경로를 역추적")
    ap.add_argument("--endpoint", help="이 엔드포인트가 실제로 도달하는 함수")
    ap.add_argument("--button", help="이 버튼 id 에서 출발")
    ap.add_argument("--assert", dest="assert_expr", help="'버튼id -> 함수' 가 닿는지 검사(exit code)")
    ap.add_argument("--depth", type=int, default=6)
    a = ap.parse_args()
    if a.reaches:
        return cmd_reaches(a.reaches, a.depth)
    if a.endpoint:
        return cmd_endpoint(a.endpoint, a.depth)
    if a.button:
        return cmd_button(a.button, a.depth)
    if a.assert_expr:
        return cmd_assert(a.assert_expr, a.depth)
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())

# -*- coding: utf-8 -*-
"""[match_fill E2E] 가짜 워크북에 '실제' match_fill(serve_b2b.py 추출)을 통째로 돌려, LLM 이 부르는
다양한 호출 형태(rows='A5:E11' 문자열/튜플/None, key=('A',None)/생략, 느슨한 소스 열이름 '수납금액 합계',
결합행 'A+B' 합산, '계' 총계 스킵)를 Excel 없이 end-to-end 검증한다.
실측: output_02월 검증파일_5단계 (2026-07-31, 사용자 제보 — rows 문자열 int() 크래시 등 반복 실패).
실행: python test_runs/_test_match_fill_e2e.py   (B2B_ver 루트에서)"""
import io, os, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = io.open(os.path.join(ROOT, "serve_b2b.py"), encoding="utf-8-sig").read()

def extract_def(src, name, module_level=False):
    pat = (r"^def %s\(" if module_level else r"^([ \t]*)def %s\(") % ((re.escape(name),) if module_level else (re.escape(name),))
    m = re.search(pat, src, re.M)
    if not m: raise RuntimeError("not found: " + name)
    indent = 0 if module_level else len(m.group(1))
    lines = src[m.start():].split("\n"); out = [lines[0]]
    for ln in lines[1:]:
        if ln.strip() == "" or (len(ln) - len(ln.lstrip())) > indent: out.append(ln)
        else: break
    block = "\n".join(out)
    if indent: block = "\n".join(l[indent:] if len(l) >= indent else l for l in block.split("\n"))
    return block

class PythonComSkillError(RuntimeError): pass
def normalize_text(value): return "".join(str(value or "").lower().split())
def _col_letter(n):
    s = ""
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s
def _col_index(letter):
    n = 0
    for ch in str(letter).upper():
        if not ("A" <= ch <= "Z"): return 0
        n = n * 26 + (ord(ch) - 64)
    return n
def parse_cell(a1):
    m = re.match(r"^\$?([A-Za-z]{1,3})\$?(\d+)$", str(a1).strip())
    return (int(m.group(2)), _col_index(m.group(1)))
def parse_range(a1):
    s = str(a1).strip()
    if ":" in s:
        a, b = s.split(":", 1); return parse_cell(a), parse_cell(b)
    c = parse_cell(s); return c, c

class Book:
    def __init__(self, sheets): self.sheets = {k: [list(r) for r in v] for k, v in sheets.items()}

class FakeCtx:
    def __init__(self, book, registry):
        self._book = book; self._registry = registry
        self._shared = {"structural": [], "books": {}}; self.writes = []
    def book(self, name):
        key = str(name).strip()
        if key in self._registry: return self._registry[key]
        stem = os.path.splitext(key)[0]
        for k, v in self._registry.items():
            if os.path.splitext(k)[0] == stem: return v
        raise PythonComSkillError("book 없음: " + key)
    def _ctx_and_sheet_from_spec(self, spec):
        s = str(spec or "").strip()
        m = re.match(r"^\[([^\]]+)\](.+)$", s)
        if m: return self.book(m.group(1).strip("'\"[]")), m.group(2).strip("'\"")
        if "!" in s:
            b, sh = s.rsplit("!", 1); return self.book(b.strip("'\"[]")), sh.strip("'\"")
        return self, spec
    def _col_index(self, letter): return _col_index(letter)
    def _resolve_col(self, sheet, spec, header_row=1):
        if isinstance(spec, bool): raise PythonComSkillError("bad col")
        if isinstance(spec, (int, float)): return int(spec)
        s = str(spec).strip()
        if re.fullmatch(r"[A-Za-z]{1,3}", s): return _col_index(s)
        return self.find_header(sheet, s, header_row=int(header_row))
    def find_header(self, sheet, header_text, header_row=1):
        grid = self._book.sheets[sheet]
        row = grid[header_row - 1] if header_row - 1 < len(grid) else []
        target = str(header_text).strip()
        headers = [("" if v is None else str(v).strip()) for v in row]
        for i, t in enumerate(headers, 1):
            if t == target: return i
        nt = normalize_text(target)
        if nt:
            for i, t in enumerate(headers, 1):
                if normalize_text(t) == nt: return i
        for i, t in enumerate(headers, 1):
            if target and target in t: return i
        raise PythonComSkillError("'%s' 시트 %d행에서 헤더 '%s' 못찾음. 실제: %r" % (sheet, header_row, header_text, headers))
    def last_row(self, sheet, col=1):
        grid = self._book.sheets[sheet]; last = 0
        for r in range(len(grid)):
            row = grid[r]
            if col - 1 < len(row) and row[col - 1] is not None and str(row[col - 1]).strip() != "": last = r + 1
        return last
    def last_col(self, sheet, row=1):
        grid = self._book.sheets[sheet]; r = grid[row - 1] if row - 1 < len(grid) else []; last = 0
        for i, v in enumerate(r, 1):
            if v is not None and str(v).strip() != "": last = i
        return last
    def used_last_row(self, sheet): return len(self._book.sheets[sheet])
    def used_last_col(self, sheet): return max((len(r) for r in self._book.sheets[sheet]), default=1)
    def read(self, sheet, a1_range=None):
        grid = self._book.sheets[sheet]
        (r0, c0), (r1, c1) = parse_range(a1_range)
        out = []
        for r in range(r0, r1 + 1):
            row = grid[r - 1] if 0 <= r - 1 < len(grid) else []
            out.append([(row[c - 1] if 0 <= c - 1 < len(row) else None) for c in range(c0, c1 + 1)])
        return out
    def write(self, sheet, a1_start, values, overwrite_formulas=True):
        grid = self._book.sheets[sheet]; (r0, c0), _ = parse_range(a1_start)
        for dr, vrow in enumerate(values):
            for dc, val in enumerate(vrow):
                r, c = r0 + dr, c0 + dc
                while len(grid) < r: grid.append([])
                row = grid[r - 1]
                while len(row) < c: row.append(None)
                row[c - 1] = val; self.writes.append((sheet, r, c, val))
        return len(values)
    def normalize(self, v): return normalize_text(v)

# 실제 match_fill 주입
G = {"re": re, "normalize_text": normalize_text, "_col_letter": _col_letter,
     "PythonComSkillError": PythonComSkillError, "min": min, "max": max, "int": int,
     "str": str, "float": float, "len": len, "enumerate": enumerate, "sorted": sorted,
     "isinstance": isinstance, "list": list, "range": range, "abs": abs, "any": any}
exec(extract_def(SRC, "match_fill"), G)
FakeCtx.match_fill = G["match_fill"]

# ── 시나리오 데이터: 소스 피벗 + 대상 멀티블록(계/결합행 포함) ──
SRC_SHEET = {
    "MVNO상품명별요약": [
        ["MVNO상품명", "MVNO상품명_count", "수납금액_sum", "가입자당단가_도매대가_sum"],
        ["안전제일(망개통용)", 10, 1000, 100],
        ["안전제일", 20, 2000, 200],
        ["인포콘 올인원", 30, 3000, 300],
        ["인포콘 올인원 2.0", 40, 4000, 400],
        ["KGM FOTA", 50, 5000, 500],
        ["인포콘 프리미엄", 60, 6000, 600],
        ["우리로", 70, 7000, 700],
    ]
}
H4 = ["구분", "건수", "고객납부금액(수남급액)", "청구금액(세금계산서)", "실제정산금액", "",
      "구분", "건수", "고객납부금액(수남급액)", "청구금액(세금계산서)", "실제정산금액"]  # 2블록(첫 블록 우선 확인)
def fresh_target():
    return {
        "올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약": [
            ["■ 2026년 02월 KG모빌리티 MVNO 정산금액"], [], [], H4,
            ["안전제일_망개통용", None, None, None, None],
            ["안전제일", None, None, None, None],
            ["올인원+올인원2.0", None, None, None, None],   # 결합행
            ["FOTA", None, None, None, None],
            ["프리미엄", None, None, None, None],
            ["우리로", None, None, None, None],
            ["계", None, None, None, None],                # 총계행
        ]
    }
TGT_NAME = "올인원_중고차_CCU중복건 제거_토레스무상제공 등 요약"
SRC_SPEC = "input_202602_SS001643_ENTR_BY_STACC_001.xlsx!MVNO상품명별요약"
EXPECT = {5: (10, 1000, 100), 6: (20, 2000, 200), 7: (70, 7000, 700),
          8: (50, 5000, 500), 9: (60, 6000, 600), 10: (70, 7000, 700)}

_p = _f = 0
def t(name, cond, got=None):
    global _p, _f
    if cond: _p += 1; print("PASS " + name)
    else: _f += 1; print("FAIL " + name + ("" if got is None else "  got=%r" % (got,)))

def run_call(**kw):
    """대상을 새로 만들고 match_fill 을 호출 → (반환, cell(r,c) 함수, tgt_ctx)."""
    reg = {}
    src_ctx = FakeCtx(Book(SRC_SHEET), reg)
    tgt_ctx = FakeCtx(Book(fresh_target()), reg)
    reg["input_202602_SS001643_ENTR_BY_STACC_001.xlsx"] = src_ctx
    reg["output_02월 검증파일.xlsx"] = tgt_ctx
    res = tgt_ctx.match_fill(SRC_SPEC, TGT_NAME,
                             kw.pop("columns", {"count": "건수", "수납금액 합계": "고객납부금액", "가입자당단가_도매대가 합계": "청구금액"}),
                             **kw)
    g = tgt_ctx._book.sheets[TGT_NAME]
    def cell(r, c):
        row = g[r - 1]; return row[c - 1] if c - 1 < len(row) else None
    return res, cell

def check_full_fill(label, **kw):
    res, cell = run_call(**kw)
    ok = all((cell(r, 2), cell(r, 3), cell(r, 4)) == v for r, v in EXPECT.items())
    ok = ok and cell(11, 2) is None  # '계' 스킵
    t(label, ok, {r: (cell(r, 2), cell(r, 3), cell(r, 4)) for r in range(5, 12)})

# ★ 모델이 실제로 부른 그대로 (rows='A5:E11' 문자열 — 예전엔 int('A') 크래시)
check_full_fill("호출1: rows='A5:E11'(문자열) + key=('A','A') + 느슨한 소스열", key=("A", "A"), source_header_row=1, header_row=4, rows="A5:E11")
# rows 튜플
check_full_fill("호출2: rows=(5,11) 튜플", key=("A", "A"), header_row=4, rows=(5, 11))
# rows 생략(자동 last_row)
check_full_fill("호출3: rows 생략(자동)", key=("A", "A"), header_row=4)
# key=('MVNO상품명', None) — 대상 None → A열 기본
check_full_fill("호출4: key=('MVNO상품명', None)", key=("MVNO상품명", None), header_row=4, rows="A5:E11")
# key 생략(둘 다 A)
check_full_fill("호출5: key 생략", header_row=4, rows="A5:E11")
# columns 를 리스트로
check_full_fill("호출6: columns=[[소스,대상],...] 리스트", key=("A", "A"), header_row=4, rows="A5:E11",
                columns=[["count", "건수"], ["수납금액_sum", "고객납부금액"], ["가입자당단가_도매대가_sum", "청구금액"]])

# allow_partial: 소스에 없는 대상이 있으면 그건 건너뛰고 나머지는 채움(오류 없음)
def scenario_partial():
    reg = {}
    src_ctx = FakeCtx(Book(SRC_SHEET), reg)
    tg = fresh_target()
    tg[TGT_NAME][9] = ["존재안함상품", None, None, None, None]  # 10행을 미매칭 이름으로
    tgt_ctx = FakeCtx(Book(tg), reg)
    reg["input_202602_SS001643_ENTR_BY_STACC_001.xlsx"] = src_ctx
    reg["output_02월 검증파일.xlsx"] = tgt_ctx
    res = tgt_ctx.match_fill(SRC_SPEC, TGT_NAME,
                             {"count": "건수", "수납금액_sum": "고객납부금액", "가입자당단가_도매대가_sum": "청구금액"},
                             key=("A", "A"), header_row=4, rows="A5:E11", allow_partial=True)
    g = tgt_ctx._book.sheets[TGT_NAME]
    return res, g
res_p, gp = scenario_partial()
t("호출7: allow_partial=True → 미매칭은 건너뛰고 나머지 채움", res_p["unmatched"] == ["존재안함상품"] and gp[4][1] == 10 and gp[9][1] is None, res_p)

# strict(기본): 미매칭 있으면 아무것도 안 쓰고 오류
def scenario_strict_raise():
    reg = {}
    src_ctx = FakeCtx(Book(SRC_SHEET), reg)
    tg = fresh_target(); tg[TGT_NAME][8] = ["듣도보도못한상품", None, None, None, None]
    tgt_ctx = FakeCtx(Book(tg), reg)
    reg["input_202602_SS001643_ENTR_BY_STACC_001.xlsx"] = src_ctx
    reg["output_02월 검증파일.xlsx"] = tgt_ctx
    try:
        tgt_ctx.match_fill(SRC_SPEC, TGT_NAME,
                           {"count": "건수", "수납금액_sum": "고객납부금액", "가입자당단가_도매대가_sum": "청구금액"},
                           key=("A", "A"), header_row=4, rows="A5:E11")
        return "no-raise", tgt_ctx
    except PythonComSkillError as e:
        return str(e), tgt_ctx
msg, tctx = scenario_strict_raise()
g_s = tctx._book.sheets[TGT_NAME]
t("호출8: strict 미매칭 → 오류(후보 리포트) + 아무것도 안 씀", ("듣도보도못한상품" in msg) and g_s[4][1] is None, msg[:60])

# ── 범용 키 열 해석(실측 재현: 소스 A열 헤더가 '행 레이블'인 진짜 피벗 + key='그룹명'이 집계열과 접두 충돌) ──
def scenario_custom(src_sheet_grid, key, columns, tgt_grid=None, **kw):
    reg = {}
    src_ctx = FakeCtx(Book({"PIV": src_sheet_grid}), reg)
    tg = tgt_grid if tgt_grid is not None else fresh_target()
    tgt_ctx = FakeCtx(Book(tg), reg)
    reg["in.xlsx"] = src_ctx
    reg["out.xlsx"] = tgt_ctx
    name = list(tg.keys())[0]
    res = tgt_ctx.match_fill("in.xlsx!PIV", name, columns, key=key, **kw)
    return res, tgt_ctx._book.sheets[name]

# (9) 진짜 피벗 모양: A='행 레이블', B='제품명_count' — key='제품명' 이 B(숫자 집계열)에 붙으면 안 됨
PIV_KR = [["행 레이블", "제품명_count", "금액_sum"],
          ["사과", 3, 300], ["배", 5, 500]]
TG_SIMPLE = {"T": [["구분", "건수", "금액"], ["사과", None, None], ["배", None, None]]}
res9, g9 = scenario_custom(PIV_KR, ("제품명", "구분"), {"count": "건수", "금액_sum": "금액"},
                           tgt_grid=TG_SIMPLE, source_header_row=1, header_row=1)
t("호출9: 피벗 '행 레이블' + key가 집계열과 접두충돌 → A열 키(전부 매칭)",
  res9["matched"] == 2 and g9[1][1] == 3 and g9[2][1] == 5, (res9, g9))

# (10) 영문 피벗 'Row Labels'
PIV_EN = [["Row Labels", "name_count", "amt_sum"], ["apple", 7, 70], ["pear", 9, 90]]
TG_EN = {"T": [["구분", "건수", "금액"], ["apple", None, None], ["pear", None, None]]}
res10, g10 = scenario_custom(PIV_EN, ("name", "구분"), {"count": "건수", "amt_sum": "금액"},
                             tgt_grid=TG_EN, source_header_row=1, header_row=1)
t("호출10: 영문 'Row Labels' 피벗 → A열 키", res10["matched"] == 2 and g10[1][1] == 7, (res10, g10))

# (11) 키가 A가 아닌 C열에 '정확한 헤더'로 있으면 정확매칭이 A폴백보다 우선
SRC_C = [["기타", "값_sum", "상품명"], ["x", 100, "사과"], ["y", 200, "배"]]
TG_C = {"T": [["구분", "금액"], ["사과", None], ["배", None]]}
res11, g11 = scenario_custom(SRC_C, ("상품명", "구분"), {"값_sum": "금액"},
                             tgt_grid=TG_C, source_header_row=1, header_row=1)
t("호출11: 키가 C열 정확헤더 → 정확매칭 우선(A폴백 아님)", res11["matched"] == 2 and g11[1][1] == 100 and g11[2][1] == 200, (res11, g11))

print("\n%d passed, %d failed" % (_p, _f))
sys.exit(1 if _f else 0)

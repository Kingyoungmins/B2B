# -*- coding: utf-8 -*-
"""[정적게이트 wide-read 오탐 + match_fill 이름매칭] 순수 로직 회귀(Excel 불필요).

정적게이트: 좁은 열 스팬(≤8열) 동적 read(예: A2:D{last}, A5:A12)를 '대용량 위험'으로 잘못 막아
  8행짜리 값붙여넣기가 불필요하게 VBA 로 넘어가던 오탐을 제거하되, 넓은/폭불명/전체열 동적 read 는
  계속 막는지 확인. serve_b2b.py 의 '실제' _a1_cells_estimate / _dynamic_range_text_is_wide 를 추출해 구동.
match_fill: 소스(피벗)↔대상 구분명 이름이 완전히 안 맞아도(망개통용/올인원/올인원2.0/FOTA/프리미엄)
  규칙 0개로 자동 매칭되고, 올인원 vs 올인원2.0 이 교차오매칭되지 않는지(매칭 4단계 로직) 확인.
실측: output_02월 검증파일_5단계 (2026-07-31, 사용자 제보).
실행: python test_runs/_test_static_gate_and_matchfill.py   (B2B_ver 루트에서)
"""
import io, os, re, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = io.open(os.path.join(ROOT, "serve_b2b.py"), encoding="utf-8-sig").read()

_p = _f = 0
def t(name, cond, got=None):
    global _p, _f
    if cond:
        _p += 1; print("PASS " + name)
    else:
        _f += 1; print("FAIL " + name + ("" if got is None else "  got=%r" % (got,)))

def extract_def(src, name):
    """def name(...) 블록을 (첫 def 라인 들여쓰기 기준) 통째로 추출 후 dedent 해서 반환."""
    m = re.search(r"^([ \t]*)def %s\(" % re.escape(name), src, re.M)
    if not m:
        raise RuntimeError("not found: " + name)
    indent = len(m.group(1))
    lines = src[m.start():].split("\n")
    out = [lines[0]]
    for ln in lines[1:]:
        if ln.strip() == "" or (len(ln) - len(ln.lstrip())) > indent:
            out.append(ln)
        else:
            break
    block = "\n".join(out)
    if indent:
        block = "\n".join(l[indent:] if len(l) >= indent else l for l in block.split("\n"))
    return block

# ── 실제 소스에서 게이트 판정 함수 추출 ──
ns = {"re": re, "float": float, "int": int, "str": str, "abs": abs}
exec(extract_def(SRC, "_col_to_index"), ns)
exec(extract_def(SRC, "_a1_cells_estimate"), ns)
exec(extract_def(SRC, "_dynamic_range_text_is_wide"), ns)
_a1 = ns["_a1_cells_estimate"]
_wide = ns["_dynamic_range_text_is_wide"]

def gate_blocks(code):
    has_read = bool(re.search(r"\b(?:ctx|[A-Za-z_]\w*)\s*\.\s*read\s*\(", code))
    has_move = bool(re.search(r"\b(?:ctx|[A-Za-z_]\w*)\s*\.\s*(?:write|write_cell|write_formulas|copy|copy_sheet|filter_to_sheet|sort)\s*\(", code, re.I))
    has_tr = bool(re.search(r"\bfor\s+\w+\s+in\s+\w+|\bsorted\s*\(|\.\s*sort\s*\(|\.\s*append\s*\(|\bfilter\s*\(|\blambda\b", code, re.I))
    if not (has_read and has_move and has_tr):
        return False
    risky = False
    for m in re.finditer(r"\.\s*read\s*\(\s*[^,\n]+,\s*[fF]?([\"'])([^\"']+)\1", code, re.I):
        c = _a1(m.group(2))
        if c == float("inf") or (c is not None and c >= 200000):
            risky = True; break
    dyn = False
    for m in re.finditer(r"\.\s*read\s*\(\s*[^,\n]+,\s*f([\"'])([^\"']+)\1", code, re.I):
        if _wide(m.group(2)):
            dyn = True; break
    return risky or dyn

CODE_NARROW = (  # 실측 실패코드 형태: 좁은 동적 A2:D{n} + 정적 소형
    'def transform(ctx):\n'
    '    n = ctx.book("i.xlsx").used_last_row("MVNO상품명별요약")\n'
    '    d = ctx.book("i.xlsx").read("MVNO상품명별요약", f"A2:D{n}")\n'
    '    h = ctx.read("t", "A4:E4")\n'
    '    names = ctx.read("t", "A5:A12")\n'
    '    out = [r for r in names]\n'
    '    ctx.write("t", "A5", out)\n')
CODE_WIDE = 'def transform(ctx):\n    n=ctx.used_last_row("S")\n    d=ctx.read("S", f"A2:Z{n}")\n    o=[r for r in d]\n    ctx.write("S","A1",o)\n'
CODE_INF = 'def transform(ctx):\n    d=ctx.read("S","A:D")\n    o=[r for r in d]\n    ctx.write("S","A1",o)\n'
CODE_COLLETTER = 'def transform(ctx):\n    lc=ctx.used_last_col("S")\n    d=ctx.read("S", f"A2:{col_letter(lc)}500")\n    o=[r for r in d]\n    ctx.write("S","A1",o)\n'

t("게이트: 좁은 동적 소형(A2:D{n}) 통과", gate_blocks(CODE_NARROW) is False, gate_blocks(CODE_NARROW))
t("게이트: 넓은 동적(A2:Z{n}) 차단", gate_blocks(CODE_WIDE) is True)
t("게이트: 전체열(A:D) 차단", gate_blocks(CODE_INF) is True)
t("게이트: 폭불명(col_letter) 차단", gate_blocks(CODE_COLLETTER) is True)
t("게이트: _wide('A2:H{n}')=False(8열 경계)", _wide("A2:H{n}") is False)
t("게이트: _wide('A2:I{n}')=True(9열)", _wide("A2:I{n}") is True)

# ── match_fill 매칭 4단계 로직(정확→공백무시→기호무시→부분포함 유일최선) 재현 ──
def _nlite(s): return "".join(str(s or "").lower().split())
def _nhard(s): return re.sub(r"[^0-9a-z가-힣]", "", str(s or "").lower())

def build(src_names):
    ent = [(n, _nlite(n), _nhard(n)) for n in src_names]
    exact = {}; nlm = {}; nhm = {}
    for i, n in enumerate(src_names):
        exact.setdefault(n, i); nlm.setdefault(_nlite(n), i); nhm.setdefault(_nhard(n), i)
    return ent, exact, nlm, nhm

def match(tname, src_names, aliases=None):
    ent, exact, nlm, nhm = build(src_names)
    alias_map = {_nlite(k): _nlite(v) for k, v in (aliases or {}).items()}
    nl, nh = _nlite(tname), _nhard(tname)
    if nl in alias_map and alias_map[nl] in nlm:
        return alias_map[nl] and nlm[alias_map[nl]]
    if tname.strip() in exact: return exact[tname.strip()]
    if nl in nlm: return nlm[nl]
    if nh and nh in nhm: return nhm[nh]
    if len(nh) >= 2:
        cands = []
        for i, e in enumerate(ent):
            sh = e[2]
            if len(sh) >= 2 and (nh in sh or sh in nh):
                cands.append((abs(len(sh) - len(nh)), i))
        if cands:
            cands.sort()
            if len(cands) == 1 or cands[0][0] < cands[1][0]:
                return cands[0][1]
    return None

SRC_NAMES = ["안전제일(망개통용)", "인포콘 올인원", "인포콘 올인원 2.0", "KGM FOTA", "인포콘 프리미엄", "안전제일", "우리로"]
cases = {
    "안전제일_망개통용": "안전제일(망개통용)",   # 기호무시
    "올인원": "인포콘 올인원",                   # 부분포함(2.0 아님)
    "올인원2.0": "인포콘 올인원 2.0",            # 부분포함 유일
    "FOTA": "KGM FOTA",                          # 부분포함
    "프리미엄": "인포콘 프리미엄",               # 부분포함
    "안전제일": "안전제일",                      # 정확
}
for tgt, want in cases.items():
    ri = match(tgt, SRC_NAMES)
    got = SRC_NAMES[ri] if ri is not None else None
    t("match_fill: '%s' → '%s'" % (tgt, want), got == want, got)

# 올인원/올인원2.0 교차오매칭 없음(각각 정확히 다른 소스)
t("match_fill: 올인원≠올인원2.0 (교차오매칭 방지)", match("올인원", SRC_NAMES) != match("올인원2.0", SRC_NAMES))
# 소스에 없는 이름 → 미매칭(리포트 대상)
t("match_fill: 없는 이름 → None(리포트)", match("존재안함관리", SRC_NAMES) is None)

# ── 값 열 해석: 집계접미사(합계/sum/개수/count) 무시 퍼지 ('수납금액 합계'≈'수납금액_sum') ──
_AGG_SUF = ("합계", "총합", "소계", "총계", "sum", "count", "개수", "건수", "평균", "average", "avg", "mean", "max", "min", "최대값", "최소값", "최대", "최소")
def _agg_base(s):
    n = _nhard(s)
    for suf in _AGG_SUF:
        if len(n) > len(suf) and n.endswith(suf):
            return n[:-len(suf)]
    return n
def resolve_val(spec, headers):
    # find_header(부분포함) 흉내: 정확/부분포함 먼저
    for i, h in enumerate(headers, 1):
        if h and (str(spec).strip() == str(h).strip() or str(spec).strip() in str(h)):
            return i
    base = _agg_base(spec)
    if base:
        cands = []
        for i, h in enumerate(headers, 1):
            hb = _agg_base(h)
            if hb and (hb == base or base in hb or hb in base):
                cands.append((abs(len(hb) - len(base)), i))
        if cands:
            cands.sort()
            if len(cands) == 1 or cands[0][0] < cands[1][0]:
                return cands[0][1]
    return None

PIVOT_HDR = ["MVNO상품명", "MVNO상품명_count", "수납금액_sum", "가입자당단가_도매대가_sum"]
t("val열: 'count' → MVNO상품명_count(2)", resolve_val("count", PIVOT_HDR) == 2, resolve_val("count", PIVOT_HDR))
t("val열: '수납금액 합계' → 수납금액_sum(3)", resolve_val("수납금액 합계", PIVOT_HDR) == 3, resolve_val("수납금액 합계", PIVOT_HDR))
t("val열: '가입자당단가_도매대가 합계' → (4)", resolve_val("가입자당단가_도매대가 합계", PIVOT_HDR) == 4, resolve_val("가입자당단가_도매대가 합계", PIVOT_HDR))
t("val열: '건수'/'count' 접미사가 빈base 안 됨", _agg_base("건수") == _nhard("건수") and _agg_base("count") == "count")

# ── 요약행 '계' 스킵 + 결합행 'A+B' 부분합산 ──
def is_summary(s):
    n = _nhard(s)
    if n in ("계", "합", "합계", "소계", "총계", "누계", "총합", "합계계"):
        return True
    return any(w in n for w in ("합계", "소계", "총계", "누계", "부가세", "vat", "total", "subtotal", "grand"))
def combined_parts(tname, src_names):
    import re as _re
    parts = [p.strip() for p in _re.split(r"\s*[+＋/／]\s*|\s+및\s+", tname) if p.strip()]
    if len(parts) < 2:
        return None
    idxs = []
    for p in parts:
        ri = match(p, src_names)
        if ri is None:
            return None
        idxs.append(ri)
    return idxs

t("요약행: '계' → 스킵(summary)", is_summary("계") is True)
t("요약행: '올인원' → 스킵 아님", is_summary("올인원") is False)
t("결합행: '올인원+올인원2.0' → [올인원, 올인원2.0] 부분매칭", combined_parts("올인원+올인원2.0", SRC_NAMES) == [match("올인원", SRC_NAMES), match("올인원2.0", SRC_NAMES)])
t("결합행: 부분 중 하나라도 미매칭이면 None", combined_parts("올인원+없는거관리", SRC_NAMES) is None)
t("결합행: 단일이름은 결합 아님(None)", combined_parts("올인원", SRC_NAMES) is None)

print("\n%d passed, %d failed" % (_p, _f))
sys.exit(1 if _f else 0)

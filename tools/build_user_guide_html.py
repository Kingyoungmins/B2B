# -*- coding: utf-8 -*-
"""스킬 함수 설명서(.txt) → 사용자용 HTML 변환기.

실행: python tools/build_user_guide_html.py
      (원본 .txt 를 고친 뒤 다시 돌리면 HTML 이 갱신된다)

왜 변환기로 만드나
  설명서는 버전마다 갱신된다(0.8.0 → 0.9.0 …). 43KB HTML 을 손으로 고치는 것은
  현실적이지 않고, 손으로 옮기면 반드시 누락·오타가 난다. 원본은 .txt 하나로 두고
  보기 좋은 화면은 여기서 만든다.

만들어지는 HTML 의 성격
  · **완전 자립형** — CDN/외부 폰트/이미지 요청이 하나도 없다. 보안망 PC 에서 파일만
    열어도 100% 동작해야 하기 때문이다(외부 요청은 차단되거나 화면이 깨진다).
  · 66개 명령을 위한 **즉시 검색** — 이런 문서는 "그 명령 이름이 뭐였지"로 찾는다.
  · 인쇄/PDF 로 뽑아도 읽히게(사이드바·검색창은 인쇄에서 숨김).
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "user-guide" / "AX-Cell_스킬_함수_설명서_v0.8.0.txt"
DEST = SRC.with_suffix(".html")

BANNER = re.compile(r"^={20,}\s*$")
RULE = re.compile(r"^-{20,}\s*$")
FIELD = re.compile(r"^\s{1,4}([가-힣][가-힣 ]{1,10}?)\s*:\s?(.*)$")
SIG = re.compile(r"^ctx\.")


def parse(text):
    """제목 / 섹션 / 함수카드 / 본문 블록으로 나눈다."""
    lines = text.replace("\r\n", "\n").split("\n")
    doc = {"title": "", "subtitle": [], "sections": []}
    i, n = 0, len(lines)
    section = None

    def new_section(heading):
        nonlocal section
        num = ""
        m = re.match(r"^\s*(\d+)\.\s*(.+)$", heading)
        if m:
            num, heading = m.group(1), m.group(2)
        section = {"num": num, "title": heading.strip(), "blocks": [], "funcs": []}
        doc["sections"].append(section)

    while i < n:
        line = lines[i]

        # ── 배너(====) 로 감싼 제목 ──
        if BANNER.match(line):
            head = []
            i += 1
            while i < n and not BANNER.match(lines[i]):
                if lines[i].strip():
                    head.append(lines[i].strip())
                i += 1
            i += 1                                   # 닫는 배너
            if not head:
                continue
            if not doc["title"]:                      # 문서 맨 앞 = 문서 제목
                doc["title"] = head[0]
                doc["subtitle"] = [h.lstrip("- ").strip() for h in head[1:]]
            else:
                new_section(" ".join(head))
            continue

        # ── 함수 카드(---- 사이의 ctx.xxx) ──
        if RULE.match(line) and i + 2 < n and SIG.match(lines[i + 1].strip()):
            # 시그니처가 두 줄에 걸친 것도 있다(예: ctx.sum_lookup(원본시트, 원본키열, …,
            # 다음 줄 대상시트, …)). 한 줄만 집으면 나머지 줄과 그 아래 설명이 통째로
            # 본문으로 새 버린다 — 닫는 ---- 가 나올 때까지 이어 붙인다.
            j = i + 1
            sig_lines = []
            while j < n and not RULE.match(lines[j]) and not BANNER.match(lines[j]):
                if lines[j].strip():
                    sig_lines.append(lines[j].strip())
                j += 1
            signature = " ".join(sig_lines)
            i = j + 1                                 # 닫는 ---- 다음으로
            fields, cur = [], None
            while i < n and not RULE.match(lines[i]) and not BANNER.match(lines[i]):
                raw = lines[i]
                m = FIELD.match(raw)
                if m:
                    cur = {"label": m.group(1).strip(), "lines": [m.group(2)]}
                    fields.append(cur)
                elif raw.strip() and cur is not None:
                    cur["lines"].append(raw.strip())
                i += 1
            if section is None:
                new_section("명령")
            # 짝지어 적힌 명령이 있다: "ctx.merge(…)  /  ctx.unmerge(…)".
            # 한 카드지만 이름은 둘 다 살려야 검색·목차에서 'unmerge' 로도 찾을 수 있다
            # (안 그러면 문서엔 66개인데 66개를 다 못 찾는 상태가 된다).
            names = [p.split("(")[0].replace("ctx.", "").strip()
                     for p in re.split(r"\s+/\s+", signature) if p.strip()]
            names = [n for n in names if n]
            section["funcs"].append({"sig": signature, "name": names[0] if names else "?",
                                     "names": names or ["?"], "fields": fields})
            continue

        # ── 그 밖의 본문 ──
        if line.strip():
            if section is None:
                new_section("들어가며")
            section["blocks"].append(line)
        elif section is not None and section["blocks"] and section["blocks"][-1] != "":
            section["blocks"].append("")
        i += 1
    return doc


def esc(s):
    return html.escape(str(s), quote=True)


def render_blocks(block_lines):
    """본문 줄들을 문단/코드/목록으로. 들여쓰기가 깊으면(6칸+) 코드로 본다."""
    out, buf, mode = [], [], None

    def flush():
        nonlocal buf, mode
        if not buf:
            return
        if mode == "code":
            while buf and not buf[-1].strip():
                buf.pop()
            out.append('<pre class="code">%s</pre>' % esc("\n".join(buf)))
        else:
            text = "<br>".join(esc(b.strip()) for b in buf if b.strip())
            if text:
                cls = " class='tip'" if text.startswith("★") else ""
                out.append("<p%s>%s</p>" % (cls, text))
        buf, mode = [], None

    for raw in block_lines:
        if not raw.strip():
            flush()
            continue
        indent = len(raw) - len(raw.lstrip())
        want = "code" if (indent >= 6 or raw.lstrip().startswith(("ctx.", "def ", "out ="))) else "text"
        if mode and want != mode:
            flush()
        mode = want
        buf.append(raw if want == "code" else raw)
    flush()
    return "\n".join(out)


def render_field(f):
    label, lines = f["label"], [l for l in f["lines"] if l.strip()]
    body = "\n".join(lines)
    code_like = label in ("예시", "쓰는 법", "예시로 보면", "조건 쓰는 법", "색 쓰는 법", "값 모양")
    kind = ("ex" if label in ("예시", "예시로 보면") else
            "warn" if label in ("주의", "안전장치") else
            "what" if label == "무엇을 하나" else "info")
    inner = ('<pre class="code">%s</pre>' % esc(body)) if code_like else \
            ("<p>%s</p>" % "<br>".join(esc(l) for l in lines))
    return ('<div class="field %s"><div class="flabel">%s</div>'
            '<div class="fbody">%s</div></div>' % (kind, esc(label), inner))


def build(doc):
    # 사이드바: 섹션 + 그 안의 명령
    nav = []
    for si, sec in enumerate(doc["sections"]):
        sid = "s%d" % si
        nav.append('<div class="navsec"><a class="navtitle" href="#%s">%s%s</a>'
                   % (sid, ("<b>%s.</b> " % esc(sec["num"])) if sec["num"] else "", esc(sec["title"])))
        if sec["funcs"]:
            items = []
            for f in sec["funcs"]:
                for nm in f["names"]:          # 짝 명령(merge/unmerge)은 둘 다 목차에 올린다
                    items.append('<a class="navfn" href="#fn-%s" data-fn="%s">%s</a>'
                                 % (esc(f["name"]), esc(nm.lower()), esc(nm)))
            nav.append('<div class="navfns">' + "".join(items) + "</div>")
        nav.append("</div>")

    body = []
    total_fn = 0
    for si, sec in enumerate(doc["sections"]):
        sid = "s%d" % si
        body.append('<section id="%s" class="sec">' % sid)
        body.append('<h2>%s%s</h2>' % (('<span class="secnum">%s</span>' % esc(sec["num"])) if sec["num"] else "",
                                       esc(sec["title"])))
        if sec["blocks"]:
            body.append('<div class="prose">%s</div>' % render_blocks(sec["blocks"]))
        for f in sec["funcs"]:
            total_fn += len(f["names"])
            # 검색 대상 텍스트(이름 + 설명 전문)
            hay = (" ".join(f["names"]) + " " + f["sig"] + " " +
                   " ".join(" ".join(x["lines"]) for x in f["fields"])).lower()
            parts = [p.strip() for p in re.split(r"\s+/\s+", f["sig"]) if p.strip()]
            sig_html = '<span class="sigsep">/</span>'.join(
                '<span class="one"><span class="dot">ctx.</span>%s</span>'
                % esc(p[4:] if p.startswith("ctx.") else p) for p in parts)
            body.append(
                '<article class="fn" id="fn-%s" data-hay="%s">'
                '<h3 class="sig">%s</h3>%s</article>'
                % (esc(f["name"]), esc(hay), sig_html,
                   "".join(render_field(x) for x in f["fields"])))
        body.append("</section>")

    subtitle = " · ".join(esc(s) for s in doc["subtitle"])
    return PAGE.format(title=esc(doc["title"]), subtitle=subtitle, nav="\n".join(nav),
                       body="\n".join(body), count=total_fn)


PAGE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
/* 완전 자립형: 외부 폰트·스크립트를 부르지 않는다(보안망에서 파일만 열어도 동작해야 함) */
:root {{
  --bg:#FAFAFA; --card:#FFFFFF; --ink:#1A1A1A; --ink2:#4A4A4A; --ink3:#767676;
  --line:#E4E4E4; --accent:#1A1A1A; --code-bg:#F5F5F5; --tip:#FFF8E1; --tip-line:#E0C97A;
  --warn:#FFF3F3; --warn-line:#E9A8A8; --ex:#F3F8F4; --ex-line:#A9CDB4;
}}
@media (prefers-color-scheme: dark) {{
  :root {{
    --bg:#161616; --card:#1E1E1E; --ink:#EDEDED; --ink2:#C3C3C3; --ink3:#8E8E8E;
    --line:#333; --accent:#FFFFFF; --code-bg:#252525; --tip:#332D18; --tip-line:#7A6A33;
    --warn:#3A2323; --warn-line:#8A5252; --ex:#1F2C22; --ex-line:#4E7259;
  }}
}}
* {{ box-sizing:border-box; }}
body {{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:"Malgun Gothic","맑은 고딕",AppleSDGothicNeo-Regular,"Apple SD Gothic Neo",sans-serif;
  font-size:15px; line-height:1.75; word-break:keep-all;
}}
a {{ color:inherit; }}
.wrap {{ display:flex; align-items:flex-start; max-width:1280px; margin:0 auto; }}

/* ── 사이드바 ── */
aside {{
  position:sticky; top:0; width:270px; flex:0 0 270px; height:100vh; overflow-y:auto;
  border-right:1px solid var(--line); padding:22px 14px 40px; background:var(--card);
}}
.brand {{ font-size:15px; font-weight:700; letter-spacing:-.2px; margin:0 6px 4px; }}
.brandsub {{ font-size:11.5px; color:var(--ink3); margin:0 6px 14px; }}
#q {{
  width:100%; padding:9px 11px; font-size:13.5px; border:1px solid var(--line);
  border-radius:8px; background:var(--bg); color:var(--ink); font-family:inherit;
}}
#q:focus {{ outline:2px solid var(--accent); outline-offset:-1px; }}
#qinfo {{ font-size:11.5px; color:var(--ink3); margin:6px 4px 12px; min-height:16px; }}
.navsec {{ margin-bottom:10px; }}
.navtitle {{ display:block; padding:5px 6px; font-size:13px; color:var(--ink2); text-decoration:none; border-radius:6px; }}
.navtitle:hover {{ background:var(--code-bg); color:var(--ink); }}
.navfns {{ display:flex; flex-wrap:wrap; gap:3px; padding:2px 6px 6px; }}
.navfn {{
  font-family:Consolas,"D2Coding",monospace; font-size:11.5px; color:var(--ink3);
  text-decoration:none; padding:1px 6px; border-radius:5px; border:1px solid transparent;
}}
.navfn:hover {{ background:var(--code-bg); color:var(--ink); border-color:var(--line); }}

/* ── 본문 ── */
main {{ flex:1 1 auto; min-width:0; padding:30px 34px 80px; }}
header.doc {{ border-bottom:2px solid var(--accent); padding-bottom:16px; margin-bottom:26px; }}
header.doc h1 {{ margin:0 0 6px; font-size:26px; letter-spacing:-.5px; }}
header.doc .sub {{ color:var(--ink3); font-size:13px; }}
.sec {{ margin:0 0 34px; scroll-margin-top:16px; }}
.sec h2 {{
  font-size:19px; margin:34px 0 14px; padding-bottom:8px; border-bottom:1px solid var(--line);
  display:flex; align-items:center; gap:9px; letter-spacing:-.3px;
}}
.secnum {{
  background:var(--accent); color:var(--card); font-size:12px; font-weight:700;
  min-width:24px; height:24px; border-radius:6px; display:inline-flex;
  align-items:center; justify-content:center; flex:0 0 auto;
}}
.prose p {{ margin:.55em 0; color:var(--ink2); }}
.prose p.tip {{
  background:var(--tip); border-left:3px solid var(--tip-line);
  padding:9px 12px; border-radius:0 7px 7px 0; color:var(--ink);
}}
pre.code {{
  background:var(--code-bg); border:1px solid var(--line); border-radius:8px;
  padding:11px 13px; margin:.5em 0; overflow-x:auto;
  font-family:Consolas,"D2Coding","Courier New",monospace; font-size:12.5px; line-height:1.65;
  color:var(--ink); white-space:pre;
}}
/* ── 명령 카드 ── */
.fn {{
  background:var(--card); border:1px solid var(--line); border-radius:11px;
  padding:15px 17px; margin:11px 0; scroll-margin-top:14px;
}}
.fn h3.sig {{
  margin:0 0 11px; font-family:Consolas,"D2Coding",monospace; font-size:14.5px;
  font-weight:700; color:var(--ink); word-break:break-all;
}}
.fn h3.sig .dot {{ color:var(--ink3); font-weight:400; }}
.fn h3.sig .one {{ display:inline-block; }}
.fn h3.sig .sigsep {{ color:var(--ink3); font-weight:400; margin:0 10px; }}
.field {{ display:flex; gap:11px; margin:6px 0; align-items:flex-start; }}
.flabel {{
  flex:0 0 82px; font-size:12px; color:var(--ink3); padding-top:2px;
  text-align:right; white-space:nowrap;
}}
.fbody {{ flex:1 1 auto; min-width:0; }}
.fbody p {{ margin:0; color:var(--ink2); }}
.field.what .fbody p {{ color:var(--ink); font-weight:500; }}
.field.warn .fbody {{
  background:var(--warn); border-left:3px solid var(--warn-line);
  padding:7px 11px; border-radius:0 7px 7px 0;
}}
.field.ex .fbody pre.code {{ background:var(--ex); border-color:var(--ex-line); margin:0; }}
.hidden {{ display:none !important; }}
mark {{ background:#FFE9A8; color:#1A1A1A; border-radius:3px; padding:0 2px; }}

/* ── 인쇄 ── */
@media print {{
  aside, #q, #qinfo {{ display:none !important; }}
  body {{ background:#fff; color:#000; font-size:11pt; }}
  main {{ padding:0; }}
  .fn {{ break-inside:avoid; border-color:#bbb; }}
  .sec h2 {{ break-after:avoid; }}
}}
@media (max-width:900px) {{
  .wrap {{ display:block; }}
  aside {{ position:static; width:auto; height:auto; border-right:0; border-bottom:1px solid var(--line); }}
  main {{ padding:22px 18px 60px; }}
}}
</style>
</head>
<body>
<div class="wrap">
<aside>
  <div class="brand">AX-Cell 스킬 함수</div>
  <div class="brandsub">{subtitle}</div>
  <input id="q" type="search" placeholder="명령 이름·설명으로 찾기" autocomplete="off">
  <div id="qinfo">전체 {count}개</div>
  <nav id="nav">
{nav}
  </nav>
</aside>
<main>
  <header class="doc">
    <h1>{title}</h1>
    <div class="sub">{subtitle}</div>
  </header>
{body}
</main>
</div>
<script>
/* 즉시 검색 — 66개짜리 참고서는 "그 명령 이름이 뭐였지"로 찾는다.
   카드의 data-hay(이름+설명 전문)를 훑어 안 맞는 카드·섹션·목차를 숨긴다. */
(function () {{
  var q = document.getElementById("q");
  var info = document.getElementById("qinfo");
  var cards = [].slice.call(document.querySelectorAll(".fn"));
  var secs = [].slice.call(document.querySelectorAll(".sec"));
  var navfns = [].slice.call(document.querySelectorAll(".navfn"));
  var total = cards.length;

  function apply() {{
    var term = q.value.trim().toLowerCase();
    if (!term) {{
      cards.forEach(function (c) {{ c.classList.remove("hidden"); }});
      secs.forEach(function (s) {{ s.classList.remove("hidden"); }});
      navfns.forEach(function (a) {{ a.classList.remove("hidden"); }});
      info.textContent = "전체 " + total + "개";
      return;
    }}
    var hit = 0;
    cards.forEach(function (c) {{
      var ok = (c.getAttribute("data-hay") || "").indexOf(term) >= 0;
      c.classList.toggle("hidden", !ok);
      if (ok) hit++;
    }});
    navfns.forEach(function (a) {{
      a.classList.toggle("hidden", (a.getAttribute("data-fn") || "").indexOf(term) < 0);
    }});
    // 남은 카드가 없는 섹션은 통째로 숨긴다(설명만 있는 섹션은 검색 중엔 접어 둔다)
    secs.forEach(function (s) {{
      var any = s.querySelector(".fn:not(.hidden)");
      s.classList.toggle("hidden", !any);
    }});
    info.textContent = hit ? (hit + "개 찾음") : "찾는 명령이 없습니다";
  }}
  q.addEventListener("input", apply);
  // 목차에서 명령을 고르면 잠깐 강조해 준다(어느 카드로 왔는지 눈에 띄게)
  window.addEventListener("hashchange", function () {{
    var el = document.querySelector(location.hash || "#none");
    if (!el || !el.classList.contains("fn")) return;
    el.style.transition = "box-shadow .25s";
    el.style.boxShadow = "0 0 0 3px var(--tip-line)";
    setTimeout(function () {{ el.style.boxShadow = ""; }}, 900);
  }});
  // "/" 로 검색창 바로 가기
  document.addEventListener("keydown", function (e) {{
    if (e.key === "/" && document.activeElement !== q) {{ e.preventDefault(); q.focus(); }}
    if (e.key === "Escape" && document.activeElement === q) {{ q.value = ""; apply(); q.blur(); }}
  }});
}})();
</script>
</body>
</html>
"""


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if not SRC.exists():
        print("원본을 찾지 못했습니다:", SRC)
        return 1
    doc = parse(SRC.read_text("utf-8"))
    DEST.write_text(build(doc), encoding="utf-8", newline="")
    fns = sum(len(f["names"]) for s in doc["sections"] for f in s["funcs"])
    print("만들었습니다:", DEST)
    print("  제목:", doc["title"])
    print("  섹션:", len(doc["sections"]), "개 / 명령:", fns, "개 / 크기:",
          "%.1fKB" % (DEST.stat().st_size / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())

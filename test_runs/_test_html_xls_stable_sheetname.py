#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SBAGENT-138: .xls 로 위장한 HTML(빌링 export)을 변환·오픈할 때, 매 open 마다 random uuid 라
워크북명·시트명이 바뀌어 @멘션 캡처 시점과 VBA 실행 시점의 '시트명'이 어긋나 "시트 못 찾음"이 났다.
수정: 변환 임시파일명 앞 31자(= Excel 자동 시트명 truncate 경계)를 '원본 파일명' 해시로 고정 → 시트명이 안정.
(워크북명은 뒤 random 으로 유일 → file-lock 회피, _alias_open_workbook_name 이 등록명으로 해석.)
이 테스트는 같은 HTML-as-.xls 를 두 번(서로 다른 Excel 인스턴스=세션오픈 vs 실행오픈) 열어 시트명이 같은지 확인."""
import os, sys, tempfile
from pathlib import Path
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32
import serve_b2b as s

HTML = """<html><head><meta charset="utf-8"></head><body>
<table border=1>
<tr><td>hdrB</td><td>hdrC</td><td>hdrD</td></tr>
<tr><td>10</td><td>20</td><td></td></tr>
<tr><td>30</td><td>15</td><td></td></tr>
</table></body></html>"""


def open_names(app, path):
    wb, _t = s.excel_workbooks_open(app, path)
    return str(wb.Name), [str(x.Name) for x in wb.Worksheets]


def main():
    f = os.path.join(tempfile.gettempdir(), "billing_html.xls")
    Path(f).write_text(HTML, encoding="utf-8")
    rc = 1
    app1 = win32.DispatchEx("Excel.Application"); app1.Visible = False; app1.DisplayAlerts = False
    app2 = win32.DispatchEx("Excel.Application"); app2.Visible = False; app2.DisplayAlerts = False
    try:
        sniff = s.sniff_text_excel_suffix(f)
        n1, sh1 = open_names(app1, f)
        n2, sh2 = open_names(app2, f)
        print("sniff:", sniff)
        print("open#1 wb=%s sheets=%s" % (n1, sh1))
        print("open#2 wb=%s sheets=%s" % (n2, sh2))
        # 핵심: 시트명이 두 open 에서 동일해야 한다(워크북명은 달라도 별칭이 해석).
        ok = (sniff == ".html") and (sh1 == sh2) and len(sh1) >= 1
        print("RESULT:", "OK (sheet name stable across opens)" if ok else "FAIL (sheet name changes per open)")
        rc = 0 if ok else 2
    except Exception as e:
        import traceback; traceback.print_exc()
        print("RESULT: FAIL(EXC):", str(e)[:160])
        rc = 2
    finally:
        try: app1.Quit()
        except Exception: pass
        try: app2.Quit()
        except Exception: pass
        try: os.unlink(f)
        except Exception: pass
    sys.exit(rc)


if __name__ == "__main__":
    main()

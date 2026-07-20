#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""전체 열/행 복사 시 Excel 'Link' 클립보드의 R1C1 표기를 실측하고,
새 R1C1->A1 변환기 + 전체열/행 네이티브 복사 동작을 검증한다.
클립보드는 하나뿐이라 반드시 직렬 실행."""
import os, sys, shutil, tempfile, re, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import win32com.client as win32
import win32clipboard as cb

SRC_XLSX = os.path.join(ROOT, "test_data", "v059_복붙캡처.xlsx")


# ---- 후보 신규 변환기 (serve_b2b 에 넣기 전 검증용) ----
def _col_letter(c):
    c = int(c); s = ""
    while c > 0:
        c, rem = divmod(c - 1, 26)
        s = chr(65 + rem) + s
    return s

def r1c1_to_a1_NEW(r1c1):
    s = str(r1c1).strip()
    def conv(tok):
        tok = tok.strip()
        m = re.match(r"^R(\d+)C(\d+)$", tok)
        if m:
            return _col_letter(m.group(2)) + m.group(1), "cell"
        m = re.match(r"^C(\d+)$", tok)
        if m:
            return _col_letter(m.group(1)), "col"
        m = re.match(r"^R(\d+)$", tok)
        if m:
            return m.group(1), "row"
        return tok, "raw"
    if ":" in s:
        a, b = s.split(":", 1)
        ca, _ = conv(a); cbb, _ = conv(b)
        return ca + ":" + cbb
    c, t = conv(s)
    if t == "col":
        return c + ":" + c
    if t == "row":
        return c + ":" + c
    return c


def read_link_r1c1():
    raw = None
    for _ in range(8):
        try:
            cb.OpenClipboard()
        except Exception:
            time.sleep(0.05); continue
        try:
            f = 0
            while True:
                f = cb.EnumClipboardFormats(f)
                if f == 0:
                    break
                try:
                    nm = cb.GetClipboardFormatName(f)
                except Exception:
                    nm = ""
                if nm == "Link":
                    raw = cb.GetClipboardData(f)
                    break
        finally:
            cb.CloseClipboard()
        break
    if raw is None:
        return None, None
    if isinstance(raw, bytes):
        for enc in ("cp949", "mbcs", "utf-8", "latin-1"):
            try:
                txt = raw.decode(enc); break
            except Exception:
                txt = None
    else:
        txt = str(raw)
    parts = txt.split("\x00")
    return (parts[2].strip() if len(parts) >= 3 else None), repr(raw[:80] if isinstance(raw, bytes) else raw)


def main():
    tmp = os.path.join(tempfile.gettempdir(), "probe_fcr.xlsx")
    shutil.copy(SRC_XLSX, tmp)
    app = win32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    try:
        wb = app.Workbooks.Open(tmp)
        ws = wb.Worksheets("원본")
        ws.Activate()

        cases = [
            ("normal A1:E6", lambda: ws.Range("A1:E6")),
            ("full cols A:E", lambda: ws.Columns("A:E")),
            ("full rows 1:6", lambda: ws.Rows("1:6")),
            ("single cell B2", lambda: ws.Range("B2")),
            ("single full col C", lambda: ws.Columns("C:C")),
            ("single full row 3", lambda: ws.Rows("3:3")),
        ]
        print("=== 클립보드 R1C1 실측 + 신규 변환기 ===")
        results = {}
        for label, getrng in cases:
            rng = getrng()
            rng.Select()
            rng.Copy()
            time.sleep(0.1)
            r1c1, rawrepr = read_link_r1c1()
            a1 = r1c1_to_a1_NEW(r1c1) if r1c1 else None
            results[label] = (r1c1, a1)
            print("%-20s R1C1=%-14r -> A1=%-12r  raw=%s" % (label, r1c1, a1, rawrepr))
            app.CutCopyMode = False

        print("\n=== 전체열/행 네이티브 복사 동작 검증 ===")
        # 전체 열 A:E -> G1
        a1_cols = results["full cols A:E"][1]   # 'A:E'
        try:
            ws.Range(a1_cols).Copy(ws.Range("G1"))
            app.CutCopyMode = False
            g1 = ws.Range("G1").Value
            j2 = ws.Range("J2").Formula     # 금액수식(D->J) 보존?
            print("full-col copy A:E -> G1: OK  G1=%r  J2.Formula=%r" % (g1, j2))
            col_ok = (str(g1) == "품목") and str(j2).startswith("=") and "H2" in str(j2)
        except Exception as e:
            print("full-col copy FAILED:", e); col_ok = False

        # 전체 행 1:6 -> A8 (다른 시트 흔적 피하려 대상 시트로)
        a1_rows = results["full rows 1:6"][1]   # '1:6'
        try:
            ws.Range(a1_rows).Copy(ws.Range("A8"))
            app.CutCopyMode = False
            a8 = ws.Range("A8").Value
            d9 = ws.Range("D9").Formula
            print("full-row copy 1:6 -> A8: OK  A8=%r  D9.Formula=%r" % (a8, d9))
            row_ok = (str(a8) == "품목") and str(d9).startswith("=")
        except Exception as e:
            print("full-row copy FAILED:", e); row_ok = False

        # 기대 변환 검증
        exp = {
            "normal A1:E6": "A1:E6",
            "full cols A:E": "A:E",
            "full rows 1:6": "1:6",
            "single cell B2": "B2",
            "single full col C": "C:C",
            "single full row 3": "3:3",
        }
        conv_ok = all(results[k][1] == v for k, v in exp.items())
        print("\nconv_ok=%s  col_ok=%s  row_ok=%s" % (conv_ok, col_ok, row_ok))
        for k, v in exp.items():
            mark = "OK" if results[k][1] == v else "MISMATCH(want %s)" % v
            print("  %-20s -> %-10r %s" % (k, results[k][1], mark))
        ok = conv_ok and col_ok and row_ok
        print("RESULT:", "OK" if ok else "FAIL")
        wb.Close(SaveChanges=False)
        sys.exit(0 if ok else 2)
    finally:
        app.Quit()


if __name__ == "__main__":
    main()

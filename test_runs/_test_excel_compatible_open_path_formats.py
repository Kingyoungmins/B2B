#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Excel-compatible open path format sniffing.

Regression: HTML-as-.xls opens through Excel, then SaveCopyAs may create a PK
package containing xl/workbook.bin while the path still ends with .xls. Treating
all PK packages as .xlsx made saved-skill replay fail with Excel's
"file format or extension is not valid" error. The opener must choose .xlsb for
that package shape and .html for text/HTML disguises.
"""
import os
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import serve_b2b as s


def _write_zip(path, names):
    with zipfile.ZipFile(path, "w") as zf:
        for name in names:
            zf.writestr(name, b"x")


def ck(name, cond):
    if not cond:
        raise AssertionError(name)
    print(" OK ", name)


def main():
    old_backend = s.BACKEND_DIR
    with tempfile.TemporaryDirectory(prefix="b2b_format_sniff_") as td:
        root = Path(td)
        s.BACKEND_DIR = root / "backend"

        html_xlsx = root / "html_disguised.xlsx"
        html_xlsx.write_text("<html><body><table><tr><td>A</td></tr></table></body></html>", encoding="utf-8")
        open_path, temp_path = s.excel_compatible_open_path(html_xlsx)
        ck("HTML content with .xlsx suffix opens as .html", open_path.suffix.lower() == ".html" and temp_path)

        xlsb_as_xls = root / "binary_package_named.xls"
        _write_zip(xlsb_as_xls, ["[Content_Types].xml", "_rels/.rels", "xl/workbook.bin", "xl/styles.bin"])
        ck("XLSB package sniffed as .xlsb", s.excel_zip_file_suffix(xlsb_as_xls) == ".xlsb")
        open_path, temp_path = s.excel_compatible_open_path(xlsb_as_xls)
        ck("XLSB package with .xls suffix opens as .xlsb", open_path.suffix.lower() == ".xlsb" and temp_path)

        xlsx_as_xls = root / "openxml_named.xls"
        _write_zip(xlsx_as_xls, ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml"])
        ck("XLSX package sniffed as .xlsx", s.excel_zip_file_suffix(xlsx_as_xls) == ".xlsx")
        open_path, temp_path = s.excel_compatible_open_path(xlsx_as_xls)
        ck("XLSX package with .xls suffix opens as .xlsx", open_path.suffix.lower() == ".xlsx" and temp_path)

        xlsb_ok = root / "already.xlsb"
        _write_zip(xlsb_ok, ["[Content_Types].xml", "_rels/.rels", "xl/workbook.bin"])
        open_path, temp_path = s.excel_compatible_open_path(xlsb_ok)
        ck("Already-correct .xlsb is not copied", open_path == xlsb_ok and temp_path is None)

    s.BACKEND_DIR = old_backend
    print("RESULT: OK")


if __name__ == "__main__":
    main()

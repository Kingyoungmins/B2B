"""Excel 앱/워크북 헬퍼 — 기존 파일 열기·목록·결과 저장 (실제 Excel 필요).

여러 엑셀 파일을 한 인스턴스에 열고(다중 워크북 작업), 변경된 워크북을 저장한다.
경로/확장자 정리 같은 순수 로직은 COM 없이 테스트 가능.
"""
from __future__ import annotations

import os

XL_OPENXML = 51  # xlOpenXMLWorkbook (.xlsx)
EXCEL_EXTS = (".xlsx", ".xlsm", ".xlsb", ".xls", ".csv")


def out_name(name: str) -> str:
    """저장 파일명 정리 — 확장자가 없으면 .xlsx 부여(순수)."""
    _, ext = os.path.splitext(name)
    return name if ext.lower() in EXCEL_EXTS else name + ".xlsx"


def open_files(app, paths, registry=None):
    """기존 엑셀 파일들을 같은 인스턴스에 연다."""
    opened = []
    for p in paths:
        wb = app.Workbooks.Open(os.path.abspath(p))
        if registry is not None:
            registry.register(wb)
        opened.append(wb)
    return opened


def list_workbooks(app):
    """열린 워크북 메타 목록."""
    out = []
    for wb in app.Workbooks:
        try:
            out.append({"name": wb.Name, "path": wb.FullName, "saved": bool(wb.Saved)})
        except Exception:
            pass
    return out


def save_all(app, out_dir=None):
    """열린 워크북 저장. out_dir 지정 시 그 폴더에 같은 이름으로 SaveAs(원본 보존),
    없으면 제자리 저장(Save). 결과 경로/오류 리스트 반환."""
    results = []
    for wb in app.Workbooks:
        try:
            if out_dir:
                target = os.path.join(out_dir, out_name(wb.Name))
                if target.lower().endswith(".xlsx"):
                    wb.SaveAs(target, FileFormat=XL_OPENXML)
                else:
                    wb.SaveAs(target)
                results.append(target)
            else:
                wb.Save()
                results.append(wb.FullName)
        except Exception as e:
            results.append(f"[실패] {getattr(wb, 'Name', '?')}: {e}")
    return results

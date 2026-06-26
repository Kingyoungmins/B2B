import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import serve_b2b as server  # noqa: E402


class FakeWorkbook:
    def __init__(self, name):
        self.Name = name


class FakeApp:
    def __init__(self, names, pid=43210):
        self.Workbooks = [FakeWorkbook(name) for name in names]
        self._pid = pid


def expect_eq(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def main():
    original_pid = server._excel_process_id
    server._excel_process_id = lambda app: getattr(app, "_pid", 0)
    try:
        original = "엔씨 자료_회선_26년3월 사용내역_26년4월청구분_260421.xlsx"
        prefixed = "e7122d47cba943649e4316ab6077f8cb_" + original
        app = FakeApp([prefixed])
        expect_eq(server._alias_open_workbook_name(app, original), prefixed, "hash-prefixed workbook should resolve")

        # Same hidden HTML-disguised .xls reopened twice: stale alias must not make resolution ambiguous.
        xls_name = "500255622398_500127886611_500255674847_500255674848-20260531.xls"
        stale_actual = "excel_open_aaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbb.html"
        current_actual = "excel_open_ccccccccccccccccccccdddddddddddddddddddd.html"
        app = FakeApp([current_actual])
        server._stash_workbook_name_alias(app, xls_name, stale_actual)
        server._stash_workbook_name_alias(app, xls_name, current_actual)
        expect_eq(server._alias_open_workbook_name(app, xls_name), current_actual, "stale HTML alias should be ignored")

        # Ambiguous current matches must remain unresolved.
        app = FakeApp([prefixed, "ffffffffffffffffffffffffffffffff_" + original])
        expect_eq(server._alias_open_workbook_name(app, original), original, "ambiguous generated names should not resolve")
    finally:
        server._excel_process_id = original_pid
        server._WB_NAME_ALIASES.clear()


if __name__ == "__main__":
    main()
    print("OK workbook alias matching")

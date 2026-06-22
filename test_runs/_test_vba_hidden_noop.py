from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import serve_b2b  # noqa: E402


def assert_allowed(name, code):
    if not serve_b2b._vba_allows_unchanged_fingerprint_success(code):
        raise AssertionError(f"{name} should be allowed")


def assert_blocked(name, code):
    if serve_b2b._vba_allows_unchanged_fingerprint_success(code):
        raise AssertionError(f"{name} should not be allowed")


def main():
    assert_allowed(
        "row_unhide",
        'Sub B2BSkill()\nDim ws As Worksheet\nws.Rows("3:5").Hidden = False\nEnd Sub',
    )
    assert_allowed(
        "col_hide",
        'Sub B2BSkill()\nDim ws As Worksheet\nws.Columns("A:C").Hidden = True\nEnd Sub',
    )
    assert_allowed(
        "entire_row_unhide",
        "Sub B2BSkill()\nSelection.EntireRow.Hidden = False\nEnd Sub",
    )
    assert_allowed(
        "entire_col_hide",
        "Sub B2BSkill()\nSelection.EntireColumn.Hidden = True\nEnd Sub",
    )
    assert_blocked(
        "value_write",
        'Sub B2BSkill()\nDim ws As Worksheet\nws.Range("A1").Value = 1\nEnd Sub',
    )
    assert_blocked(
        "comment_only",
        'Sub B2BSkill()\n\' ws.Rows("3:5").Hidden = False\nEnd Sub',
    )
    print("vba hidden noop smoke: ok")


if __name__ == "__main__":
    main()

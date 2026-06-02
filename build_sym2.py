#!/usr/bin/env python3
"""
.sym2_template.html → sym2.html 빌드 스크립트
템플릿 수정 후 python3 build_sym2.py 실행
"""
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
TEMPLATE = BASE / ".sym2_template.html"
BUNDLE = BASE / "sym2.html"


def main():
    template_html = TEMPLATE.read_text(encoding="utf-8")
    encoded = json.dumps(template_html, ensure_ascii=False).replace("</script>", r"<\/script>")

    bundle_src = BUNDLE.read_text(encoding="utf-8")
    pattern = r'<script type="__bundler/template">.*?<\/script>'
    new_block = f'<script type="__bundler/template">{encoded}</script>'
    new_src = re.sub(pattern, lambda _: new_block, bundle_src, count=1, flags=re.DOTALL)

    if new_src == bundle_src:
        print("ERROR: __bundler/template 섹션을 찾지 못했습니다.", file=sys.stderr)
        return 1

    BUNDLE.write_text(new_src, encoding="utf-8")
    print(f"완료: {BUNDLE.name} ({len(new_src):,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

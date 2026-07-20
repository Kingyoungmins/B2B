# 5단계 스킬 zip 내용 덤프 — 무슨 작업(코드/좌표)을 하는지 확인(추측금지).
import sys, io, zipfile, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ZIP = r"C:\Users\Admin\Downloads\531611708899생명 로우데이터_DSMC_260616_5단계_2026-07-01-09-33-01.zip"
z = zipfile.ZipFile(ZIP)
print("=== zip 엔트리 ===")
for i in z.infolist():
    comp = "STORED" if i.compress_type == zipfile.ZIP_STORED else f"type{i.compress_type}"
    print(f"  {i.filename}  ({i.file_size}B, {comp})")

for name in z.namelist():
    if name.endswith("/"):
        continue
    print("\n" + "=" * 70)
    print("FILE:", name)
    print("=" * 70)
    raw = z.read(name)
    try:
        text = raw.decode("utf-8-sig")
    except Exception:
        try:
            text = raw.decode("utf-8", "replace")
        except Exception:
            print(f"(바이너리 {len(raw)}B, 스킵)")
            continue
    # JSON 이면 예쁘게
    if name.lower().endswith(".json"):
        try:
            obj = json.loads(text)
            print(json.dumps(obj, ensure_ascii=False, indent=2)[:20000])
            continue
        except Exception:
            pass
    print(text[:20000])

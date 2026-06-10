# -*- coding: utf-8 -*-
# 충돌 헝크 추출/요약/해결 도구. usage:
#   python _tmp_hunks.py digest <file>           : 헝크 요약 출력
#   python _tmp_hunks.py full <file> <idx>       : 헝크 전문 출력
#   python _tmp_hunks.py apply <file> <d1,d2,..> : ours/theirs/both(ours+theirs)/boththeirs(theirs+ours) 일괄 적용
import sys, re, io
try: sys.stdout.reconfigure(encoding="utf-8")
except: pass

def load(p):
    raw = open(p, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    return text, bom

RX = re.compile(r"^<<<<<<< HEAD\r?\n(.*?)^=======\r?\n(.*?)^>>>>>>> ver0\.5\.0\r?\n", re.S | re.M)

def hunks(text):
    return list(RX.finditer(text))

def digest(p):
    text, _ = load(p)
    for i, m in enumerate(hunks(text), 1):
        ours, theirs = m.group(1), m.group(2)
        ol, tl = ours.splitlines(), theirs.splitlines()
        line_no = text[:m.start()].count("\n") + 1
        print(f"\n======== HUNK {i} @line{line_no}  ours={len(ol)}L theirs={len(tl)}L ========")
        def show(tag, ls):
            print(f"  --{tag}--")
            if len(ls) <= 14:
                for l in ls: print("   |", l[:150])
            else:
                for l in ls[:7]: print("   |", l[:150])
                print(f"   ... ({len(ls)-12} lines) ...")
                for l in ls[-5:]: print("   |", l[:150])
        show("OURS(0.5.1)", ol)
        show("THEIRS(0.5.0)", tl)

def full(p, idx):
    text, _ = load(p)
    m = hunks(text)[idx - 1]
    print(f"==== HUNK {idx} OURS ====")
    print(m.group(1))
    print(f"==== HUNK {idx} THEIRS ====")
    print(m.group(2))

def apply(p, decisions):
    text, bom = load(p)
    ms = hunks(text)
    assert len(decisions) == len(ms), f"decisions {len(decisions)} != hunks {len(ms)}"
    out, pos = [], 0
    for m, d in zip(ms, decisions):
        out.append(text[pos:m.start()])
        if d == "ours": out.append(m.group(1))
        elif d == "theirs": out.append(m.group(2))
        elif d == "both": out.append(m.group(1) + m.group(2))
        elif d == "boththeirs": out.append(m.group(2) + m.group(1))
        elif d == "skip": out.append(m.group(0))  # 그대로 둠(수동 처리 예정)
        else: raise SystemExit(f"unknown decision {d}")
        pos = m.end()
    out.append(text[pos:])
    data = "".join(out).encode("utf-8")
    if bom: data = b"\xef\xbb\xbf" + data
    open(p, "wb").write(data)
    print(f"applied {len(ms)} hunks to {p}")

cmd = sys.argv[1]
if cmd == "digest": digest(sys.argv[2])
elif cmd == "full": full(sys.argv[2], int(sys.argv[3]))
elif cmd == "apply": apply(sys.argv[2], sys.argv[3].split(","))

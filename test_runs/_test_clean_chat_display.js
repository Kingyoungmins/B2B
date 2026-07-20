// cleanChatDisplayText 를 실제 5단계 zip 의 사용자 메시지들에 적용해 검증(표시 정리).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "chat-ui.js"), "utf8");
const a = src.indexOf("function cleanChatDisplayText");
const b = src.indexOf("function scrollChatToStepRequest");
eval(src.slice(a, b) + "\nglobalThis.clean=cleanChatDisplayText;");

const ZIP = "C:\\Users\\Admin\\Downloads\\531611708899생명 로우데이터_DSMC_260616_5단계_2026-07-01-09-33-01.zip";
function readLogic(zp){const buf=fs.readFileSync(zp);let off=0,logic=null;while(off+4<=buf.length&&buf.readUInt32LE(off)===0x04034b50){const method=buf.readUInt16LE(off+8),cs=buf.readUInt32LE(off+18),nl=buf.readUInt16LE(off+26),el=buf.readUInt16LE(off+28);const name=buf.toString("utf8",off+30,off+30+nl);const ds=off+30+nl+el;const comp=buf.slice(ds,ds+cs);if(name.endsWith(".logic.json"))logic=JSON.parse((method===0?comp:zlib.inflateRawSync(comp)).toString("utf8"));off=ds+cs;}return logic;}

const hist = (readLogic(ZIP).chatHistory) || [];
let pass = 0, fail = 0;
function ck(n,c){ if(c){pass++;console.log(" OK  "+n);} else {fail++;console.log("FAIL "+n);} }

let shown = 0, hidden = 0, refSeen = 0;
hist.filter(m => m.role === "user").forEach((m, i) => {
  const out = clean(m.content);
  const before = m.content.replace(/\s+/g," ").slice(0, 50);
  const after = (out || "(숨김)").replace(/\s+/g," ").slice(0, 50);
  if (out && out.trim()) shown++; else hidden++;
  if (out && /\[정확\s*참조\]/.test(out)) refSeen++;   // 남아있으면 안 됨
  console.log(`user#${i}: [${before}] -> [${after}]`);
});

console.log(`\n표시 ${shown} · 숨김 ${hidden}`);
ck("[정확 참조] 블록이 표시에 하나도 안 남음", refSeen === 0);
ck("자동 재생성/복구 프롬프트는 숨겨짐(hidden>0)", hidden > 0);
ck("실제 사용자 요청은 남음(shown>0)", shown > 0);
// 구체 케이스
ck("정확참조 붙은 요청 → 앞부분만", clean("이거 지워줘\n\n[정확 참조]\n- 선택 범위: a!A1\n[정확 참조 사용 규칙 - 강제]\n- ...") === "이거 지워줘");
ck("정적검사 재생성 프롬프트(메모無) → 숨김", clean("방금 생성한 VBA 가 적용 직전 정적 안전 검사에서 막혔습니다. 원래 사용자 요청을 반영해 다시 작성하세요.\n## 실패한 코드\n```vba\nSub x()\nEnd Sub\n```") === "");
ck("에러복구(사용자 메모有) → 메모만", clean("## ★ 사용자 추가 설명 — 최우선 반영\n아래는 사용자가 직접 적은 설명입니다.\n합계가 틀려요 다시 해줘\n\nStep 3 실행 중 오류가 발생했습니다.\n## 실패한 코드\n```\nx\n```") === "합계가 틀려요 다시 해줘");
ck("[규칙 수정]/[사용자 보충 설명] 래퍼 제거", clean("[규칙 수정]\n\n[사용자 보충 설명] [적용1] 이렇게 해줘\n\n[정확 참조]\n- x") === "[적용1] 이렇게 해줘");

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);

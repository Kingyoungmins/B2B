// [제보 2026-08-13] 선택 범위가 3:5 인 상태에서
//     "숨겨진 행을 숨기기 취소하고 숨겨진 4행을 삭제해줘"
// 라고 했더니 생성된 코드가
//     ctx.hide_rows("VIEW", "3:5", hidden=False)
//     ctx.delete_rows("VIEW", "3:5")      ← 4행만 지워야 하는데 3~5 를 다 지웠다
//
// 원인: 프롬프트 규칙이 "'현재 선택 범위'가 제공되면 대상 범위로 그 주소를 사용하세요" 라고만
// 적혀 있었다. 선택이 '기본값'이라는 말도, 요청문이 그 안에서 특정 행을 집으면 그게 이긴다는
// 말도, 동작이 여러 개면 각각 대상을 따로 잡으라는 말도 없었다.
//
// 행 삭제는 되돌리기 어렵다 — 넓게 지우면 데이터가 사라진다. 규칙으로 못박는다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const fsch = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 선택 범위는 '기본값'이고 요청문의 지목이 이긴다");
check("선택 범위가 기본값이라고 말한다", /선택 범위는 '기본값'일 뿐입니다/.test(fsch));
check("요청문이 특정 행/열/셀을 집으면 그게 이긴다", /특정 행\/열\/셀을 콕 집으면 그 지목이 이깁니다/.test(fsch));
check("제보된 사례를 예시로 남겼다(3:5 선택 + 4행 삭제)",
  /선택이 .*3:5.* 인데 요청이 "숨겨진 \*\*4행\*\*을 삭제해줘"/.test(fsch));
check("넓게 지우면 무슨 일이 나는지 적었다", /3·5행까지 날아가 데이터가 사라집니다/.test(fsch));

console.log("[2] 동작이 여러 개면 대상을 각각 정한다");
check("앞 동작의 범위를 뒤 동작에 재사용하지 말라고 한다",
  /앞 동작의 범위를 뒤 동작에 그대로 쓰지 마세요/.test(fsch));
check("숨김해제 3:5 · 삭제 4:4 로 갈리는 예시가 있다",
  /숨김 해제는 .*3:5.*, 삭제는 .*4:4.*/.test(fsch));

console.log("[3] 행 삭제는 특히 좁게");
check("숫자로 명시된 행만 지우라고 한다", /그 숫자만.*지우고, 범위를 넓히지 마세요/.test(fsch));
check("되돌리기 어렵다는 이유를 밝힌다", /행 삭제는 되돌리기 어렵습니다/.test(fsch));

console.log("[3b] '사이에 삽입' — 뒤쪽 것의 자리에 넣는다");
// [제보 2026-08-13] 선택이 S:T 인데 "사이에 열 1개 추가해줘" 라고 하니
//   ctx.insert_cols("VIEW", "S", count=1)  → S 앞에 들어가 R·S 사이가 됐다.
// Insert 는 '그 앞에' 넣으므로 S·T 사이는 "T" 자리다.
check("삽입이 '그 앞에' 들어간다는 사실을 명시", /삽입은 "그 앞에" 들어갑니다/.test(fsch));
check("'A와 B 사이' = 뒤쪽 것의 자리", /"A와 B 사이에 넣어줘" 는 뒤쪽 것\(B\)의 자리에 삽입한다는 뜻입니다/.test(fsch));
check("제보 사례를 예시로 박았다(S·T 사이 → T)",
  /"S열과 T열 사이에 열 1개 추가" → .*insert_cols\("시트", "T", count=1\)/.test(fsch));
check("잘못 쓰면 어디로 들어가는지 적었다", /R 과 S 사이에 들어갑니다/.test(fsch));
check("행도 같은 규칙(3·4행 사이 → 4)", /"3행과 4행 사이에 행 추가" → .*insert_rows\("시트", 4\)/.test(fsch));
check("선택 범위를 그대로 삽입 위치로 쓰지 말라고 한다",
  /선택 범위를 그대로 삽입 위치로 쓰지 마세요/.test(fsch));
check("'앞에/뒤에' 표현도 갈라 놨다", /"S열 앞에", "S열 왼쪽에" 는/.test(fsch));

console.log("[3c] 수식이 자기 칸을 포함하면 순환참조");
// [제보 2026-08-13] 선택 T:T + "T3 에 합계를 함수식으로" → =SUM(T:T) 가 생성돼
// T3 자신을 포함, 순환참조로 값이 0. 사용자에 따라 되기도 안 되기도 했다(모델 편차).
// 규칙이 아예 없었다 — '선택 범위를 대상 범위로 쓰라'는 규칙만 있어 오히려 그쪽으로 유도했다.
check("순환참조를 명시적으로 금지", /수식을 넣는 칸이 그 수식의 집계 범위 안에 있으면 순환참조입니다/.test(fsch));
check("대상 칸을 범위에서 빼라고 한다", /대상 칸을 범위에서 반드시 빼세요/.test(fsch));
check("제보 사례를 예시로 박았다(T3 → SUM(T4:...))",
  /T3 에 "이 아래 전부 합계" → .*=SUM\(T4:T1048576\)/.test(fsch));
check("=SUM(T:T) 가 왜 틀린지 적었다", /=SUM\(T:T\).*는 T3 자신을 포함해 순환참조가 됩니다/.test(fsch));
check("열 전체 선택의 의미를 갈라 놨다",
  /열 전체 선택은 "이 열을 대상으로"라는 뜻이지/.test(fsch));
check("행 수가 변해도 맞는 쓰기 방법을 준다(끝행 박기 금지)",
  /대상 칸 다음 행부터 열 끝까지/.test(fsch) && /굳이 박아 넣으면 나중에 행이 늘었을 때 빠집니다/.test(fsch));

console.log("[4] 기존 규칙을 지우지 않았다(선택이 없을 때의 동작 보존)");
check("선택이 제공되면 그 주소를 쓴다는 원칙은 그대로",
  /"현재 선택 범위"가 제공되면 대상 범위로 그 주소\(Selection 영역\)를 사용하세요/.test(fsch));
check("명시도 선택도 없으면 데이터 실제 범위로 한정",
  /명시 범위가 없고 선택도 없으면 데이터 실제 범위를 스스로 계산해 한정하세요/.test(fsch));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);

// file-schema.js 소스에서 프롬프트 상수를 '실제 문자열'로 뽑아 stdout 출력(백틱/이스케이프 해제).
// 사용: node _extract_prompt.js <file-schema.js 경로> [상수명(기본 PYTHON_COM_SYSTEM_PROMPT)]
const fs = require("fs");
const path = process.argv[2];
const which = process.argv[3] || "PYTHON_COM_SYSTEM_PROMPT";
const src = fs.readFileSync(path, "utf8");
// 파일 전체를 함수 본문으로 평가(상수/함수 '정의'만 실행됨; state/DOM 참조 함수는 호출 안 하므로 안전).
const val = new Function("return (function(){ " + src + "\n; return typeof " + which + " !== 'undefined' ? " + which + " : ''; })();")();
process.stdout.write(String(val || ""));

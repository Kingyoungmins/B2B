// duplicateRowDeleteIntent / conditionalRowDeleteIntent 의 실제 정규식을 후보 프롬프트에 대고 확인.
// (raise+copy_key_blocks 파이썬이 VBA 로 튕긴 원인 특정)
const dupDelete = /(?:중복\s*값?|중복값|duplicate).{0,24}(?:제거|삭제|지워|없애|remove|delete)|(?:제거|삭제|지워|없애|remove|delete).{0,24}(?:중복\s*값?|중복값|duplicate)/i;
const rowDeleteShape = /(행|위에\s*있는|아래|먼저|EID|ID|키|코드|가입번호|고객번호|계약번호|수납금액|금액|보호|지우면\s*안|삭제하면\s*안|1\s*이상|>=\s*1)/i;
const condRowDelete = /(행|row).{0,20}(삭제|지워|없애|제거|delete|remove)|(?:삭제|지워|없애|제거|delete|remove).{0,20}(행|row)/i;

function dup(s){ return dupDelete.test(s) && rowDeleteShape.test(s); }
function cond(s){ return condRowDelete.test(s); }

const cases = {
  "A 내제안(지우지 말고)": "가입번호를 키로 병합 블록 전체를 그대로 복사해줘. 첫 행만 가져오거나 중복이라고 지우지 말고 블록 전체를 넣어줘. 없는 가입번호는 건너뛰고 알려줘.",
  "B 중복 행 삭제하지마": "가입번호 기준으로 복사해줘. 중복된 행 삭제하지 마.",
  "C 지우지마(붙임)": "가입번호 블록 전체 복사. 중복이라고 지우지마.",
  "D 중복 지워(진짜삭제)": "가입번호 열에서 중복된 행 지워줘.",
  "E 중복 제거(진짜삭제)": "중복 가입번호 행 제거해줘.",
};
for (const [k, s] of Object.entries(cases)) {
  console.log(`${dup(s)?"DUP ":"    "}${cond(s)?"COND":"    "}  ${k}`);
}

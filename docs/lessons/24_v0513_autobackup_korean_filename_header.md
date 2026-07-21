# 24. 스킬 자동저장 .zip 이 안 생김 — 한글 파일명 HTTP 헤더 (SBAGENT-138, v0.5.13)

## 증상
스킬 자동저장(폴더 설정 여부 무관) .zip 이 전혀 생기지 않음. 자동저장 폴더는 정상 설정됨
(settings.json 의 logicBackupDir 기록됨), 그 폴더와 기본 auto_backup 폴더 모두 **zip 0개**(한 번도 성공 X).
수동 저장(다운로드)은 정상.

## 근본 원인 (격리 서버 테스트로 확정)
자동저장 클라(`saveLogicAutoBackup`, scripts/save-load.js)는 zip 을 `/api/logic/backup` 으로 POST 하며
**파일명을 `x-filename` HTTP 헤더**에 그대로 넣었다:
```
"x-filename": `${name}.zip`   // name 예: "파워빌..._37단계_2026-...." (한글 + "단계")
```
HTTP 헤더 값은 **latin-1 만 허용**된다. 브라우저 `fetch` 는 헤더 값에 비-latin-1(한글) 문자가 있으면
요청 생성 단계에서 **TypeError(ByteString 변환 실패)로 throw** 한다 → POST 자체가 안 나감 →
`saveLogicAutoBackup` 의 try/catch 가 삼켜 `console.warn` 만 남기고 **조용히 실패**(.zip 안 생김).
→ 한글 파일명(=대부분의 실제 스킬)은 항상 실패. 수동 저장은 blob 다운로드라 헤더를 안 써서 멀쩡.

격리 서버 테스트(별도 포트/임시 config)로 확정:
- ASCII 파일명 헤더 → 서버가 zip 정상 기록. (서버는 무결)
- 한글 파일명 헤더 → 클라(urllib/브라우저 동형) 가 latin-1 인코딩 에러로 전송 실패.

## 수정
파일명을 percent-encode 해서 헤더로 보내고, 서버가 복원:
- 클라(save-load.js): `"x-filename": encodeURIComponent(`${name}.zip`)`.
- 서버(serve_b2b.py `handle_logic_backup`): `unquote(self.headers.get("x-filename") or "")` 로 복원
  (ASCII 미인코딩 값은 unquote 가 그대로 둠 → 구버전 클라 호환).

## 검증
- 격리 서버 라운드트립: `encodeURIComponent("파워빌..._37단계_....zip")` 헤더로 POST →
  서버가 unquote → **디스크에 한글 파일명 그대로** 저장(`파워빌`·`37단계` 포함 확인). PASS.
- py_compile / node --check OK.

## 교훈
- **HTTP 헤더에 비-ASCII(한글) 값 금지.** 파일명/사용자문자열을 헤더로 넘길 땐 percent-encode(또는
  RFC 5987) 필수. 브라우저 fetch 는 throw, 서버는 latin-1 로 망가짐.
- 조용한 실패(try/catch + console.warn) 는 "한 번도 성공 안 함"을 사용자에게 안 보여준다 — 자동저장
  성공/실패를 가시화(상태표시)하면 더 빨리 잡혔을 것. (선택 개선)

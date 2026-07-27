# ixicellr (벤더링)

ixi-Cell-R 레포에서 복사한 녹화·정제 엔진 (UI 제외).

- 원본: https://github.com/Nam-ang/ixi-Cell-R (p1-replay-performance @ f5ce3c0)
- 용도: B2B 내 녹화(레코드 모드) — recorder(COM 이벤트 캡처) + distiller(정제/의도주석)
  + skillstore(step→ctx 코드 변환). B2B 재현은 자체 PythonComSkillContext 를 쓰므로
  replay/ 는 .icr 호환용 참고로만 둔다.
- 갱신 방법: ixi-Cell-R 에서 src/ixicellr 를 다시 복사(ui/ 제외)하고 이 파일의 해시 갱신.

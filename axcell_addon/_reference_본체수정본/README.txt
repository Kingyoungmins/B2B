========================================================================
 본체 수정본 — 참고용 (덮어쓰지 마세요)
========================================================================

 여기 있는 5개 파일은 저희가 수정한 AX-Cell 본체 파일입니다.
 B2B-ver0.6.1 기준이라, 그 뒤에 본체를 고치셨다면 이 파일로 덮어쓰면
 그 수정이 사라집니다.

 ※ 덮어쓰기 금지. diff 를 떠서 필요한 조각만 옮겨주세요.


■ 무엇이 바뀌었나

   index.html            +74 -8    메뉴 3그룹 · 화면 컨테이너 · script/link
   scripts/menu.js        +9 -5    페이지 제목 맵 · Excel 미러 비활성 대상
   scripts/pipeline.js    +3  -0   skillName 1줄 (관측 로그용)
   launch_b2b.py         +16  -0   관측 로그 초기화 (기동 시 1회)
   serve_b2b.py          +28 -392  import 2줄 · 라우팅 2블록 · 로그 호출 3곳
                                   (-392 는 스케줄러 코드를 모듈로 옮긴 것)


■ diff/ 폴더

   변경분만 뽑아 둔 patch 파일입니다. 이것만 봐도 됩니다.

       index.html.patch            122줄
       scripts_menu.js.patch        30줄
       scripts_pipeline.js.patch    12줄
       launch_b2b.py.patch          26줄
       serve_b2b.py.patch          470줄

   보는 법:
       type diff\index.html.patch          (Windows)
       cat  diff/index.html.patch          (bash)

   적용해 보려면(권장하지 않음 — 본체 버전이 다르면 실패):
       git apply --check diff/index.html.patch


■ serve_b2b.py 가 왜 줄어들었나

   원래 저희가 스케줄러 로직 379줄을 serve_b2b.py 안에 넣었다가,
   모듈(b2b_scheduler.py)로 다시 빼냈습니다. 그래서 diff 상으로는
   많이 지워진 것처럼 보이지만, 실제로 본체에 남는 것은 28줄뿐입니다.

   순수하게 추가되는 것만 보시려면:
       findstr "^+" diff\serve_b2b.py.patch


■ 병합 순서 권장

   1. INTEGRATION.md 를 먼저 읽습니다 (붙일 코드가 전부 적혀 있음)
   2. 새 파일 6개를 복사합니다 (이름 충돌 없음)
   3. 본체 5개 파일은 diff 를 보며 조각만 옮깁니다
   4. index.html 이 가장 손이 많이 갑니다 — 메뉴 · 페이지 컨테이너 ·
      script/link 태그 세 곳입니다

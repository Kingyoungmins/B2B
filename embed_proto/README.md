# Excel Embed Prototype (ver0.4.4)

SetParent 으로 실제 Excel 창을 패널 안 자식 창으로 넣었을 때 **클릭/드래그 선택이 되는지**를
본 앱과 분리해 격리 검증하기 위한 최소 WinForms 프로토타입.

핵심 가설: **호스트 UI 스레드 ↔ Excel UI 스레드 간 `AttachThreadInput` 을 지속적으로 유지**하면
자식 Excel 이 활성 상태처럼 동작해 마우스 선택과 `Range.Select` 가 함께 살아난다.
(코덱스가 시도한 "1회성 포커스 보정" 과의 차이점이 이 부분이다.)

## 빌드 (클로드가 수행)

```powershell
powershell -ExecutionPolicy Bypass -File .\build_proto.ps1
```

결과물: `bin\ExcelEmbedProto.exe` — 외부 의존성 없음(Office PIA 불필요, Excel 은 late binding 호출).
필요 조건: 데스크톱 Excel 설치 + .NET Framework 4 (`csc.exe`).

## 검증 순서 (사용자가 수행)

핵심은 **자식(WS_CHILD)** vs **소유 팝업(owned top-level)** 두 모드에서 클릭/드래그 선택을 비교하는 것.

1. `bin\ExcelEmbedProto.exe` 실행.
2. **[1) Excel 실행]** → Excel 이 별도 창으로 뜨고 샘플 표(A1:H120)가 채워진다.
3. **[창 구조 덤프]** → 로그에 EXCEL7/XLDESK/XLMAIN 구조가 찍힘 (SDI/MDI 확인용).
4. **[2) 자식 임베드(WS_CHILD)]** → 패널 안에 들어옴. 그리드에서 클릭/드래그.
   - 상단 **"선택:"** 라벨이 바뀌나? (이전 테스트: **안 바뀜** = 입력 실패)
   - **[3) Range.Select(B61)]** → 성공/오류?
5. **[2') 소유 팝업 임베드]** → 패널 위치에 맞춰 들어옴(여전히 top-level). 그리드에서 클릭/드래그.
   - 상단 **"선택:"** 라벨이 클릭/드래그한 주소로 바뀌나? (**바뀌면 입력 성공**)
   - **[3) Range.Select(B61)]** → 성공/오류?
   - 앱 창을 이동/리사이즈했을 때 Excel 이 패널을 따라오나?

라벨 끝 `[mode=Child/OwnedPopup attach ON/OFF]` 로 현재 상태 확인.

## A/B 비교 (자식 모드에서만)

자식 모드일 때 상단 체크박스를 켜고 끄며 4단계 반복:

- **AttachThreadInput 지속** — 이미 ON 으로 테스트했고 실패함.
- **클릭 시 EXCEL7 포커스** / **패널 MouseActivate 제어** — 조합 변경 시 차이가 있는지.

> 가설: 자식(WS_CHILD)은 foreground 가 될 수 없어 최신 Excel 그리드 입력이 구조적으로 막힌다.
> 소유 팝업은 foreground 가능 → 입력이 동작하면서도 패널 안에 박힌 것처럼 보인다.

## 보고해 주실 것

각 조합에서:
- 단일 셀 클릭으로 선택이 이동하나?
- 드래그로 범위 선택이 되나?
- 키보드 방향키로 셀 이동이 되나? (선택)
- `Range.Select(B61)` 성공/실패 + 실패 시 로그 메시지 원문.

이 결과로 본 앱(NativeHost.cs / serve_b2b.py)에 이식할 최소 조합을 확정한다.

## 정리
창을 닫으면 임베드 해제 + Excel Quit 까지 정리한다. 만약 Excel 이 남으면 작업관리자에서 종료.

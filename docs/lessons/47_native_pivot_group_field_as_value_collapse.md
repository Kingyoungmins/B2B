# 47. 피벗에서 행 필드를 값(개수)에도 넣으면 표가 '총합 1줄'로 붕괴 (native_pivot / 0.7.1)

## 증상
- 사용자가 엑셀 습관대로 프롬프트를 작성:
  ```
  피벗 테이블 생성.
  행: MVNO상품명
  값: 개수:MVNO상품명, 합계:수납금액, 합계:가입자당단가_도매대가
  ```
- 기대(엑셀 UI로 하면 정상): 행=상품별, 값=개수:MVNO상품명 / 합계:수납금액 / 합계:단가 → 상품별 여러 줄.
- 실제: **상품별 행이 통째로 사라지고 "총합계 한 줄"만** 나옴
  (`MVNO상품명_count=101, 수납금액_sum, 단가_sum` 한 줄).
- 이 때문에 사용자가 2단계에서 "count 말고 종류별로"라고 교정 → 그 단계가 **개수 열을 삭제** →
  결국 개수 없는 상품별 표가 됨(반대로 반쪽). 즉 1·2단계 둘 다 원하는 표가 아니게 됨.

## 원인
- `native_pivot`(serve_b2b.py)은 엑셀 **진짜 PivotTable(COM)**을 만든다. 한 `PivotField`의
  `Orientation` 은 하나뿐 — 행이면서 값일 수 없다.
- 코드가 `group_by` 필드를 `xlRowField` 로 놓은 뒤, 같은 필드를 값으로 `AddDataField(...count...)`
  하면 **엑셀이 그 필드를 행→값으로 '이동'**시킨다. 그 결과 **행 필드가 없어져** 그룹핑이 사라지고
  피벗이 전체 총합 1줄로 붕괴.
- 엑셀 UI 에서 같은 필드를 행·값 두 영역에 드래그하면 둘 다 유지되지만, COM `AddDataField` 는
  자동으로 그렇게 해주지 않는다(실측: `pt.PivotFields(g).Orientation=xlRowField` →
  `pt.AddDataField(pt.PivotFields(g), ..., xlCount)` 하면 g 가 행에서 빠짐).
- 같은 결함이 `value=None`(그냥 "~별 개수") 경로에도 있었다 — 거기도 `AddDataField(groups[0], "개수")`
  로 행 필드를 값으로 옮겨 붕괴.
- 실측(win32com 재현, 더미데이터 8상품·101행):
  - 붕괴형: `value=["MVNO상품명","수납금액","단가"], agg=["count","sum","sum"]` → 2×3 (총합 1줄).
  - 순서만 바꿔 개수를 마지막에 넣어도 여전히 붕괴(2×3). → **순서 문제 아님.**

## 수정 (0.7.1)
- serve_b2b.py `native_pivot` 값 루프: **`AddDataField` 직후, 그 필드가 행/열 필드였으면
  Orientation 을 재지정**해 행·값 동시 배치를 복구.
  ```python
  row_field_names = set(_fname(g) for g in groups)
  col_field_name  = _fname(column) if column is not None else None
  for v, a in zip(values, aggs):
      ...
      if v is None:
          gfn = _fname(groups[0])
          pt.AddDataField(pt.PivotFields(gfn), "개수", -4112)
          pt.PivotFields(gfn).Orientation = XL_ROW           # 복구
      else:
          fnm = _fname(v)
          pt.AddDataField(pt.PivotFields(fnm), ("%s_%s" % (fnm, an))[:250], fn)
          if fnm in row_field_names:
              pt.PivotFields(fnm).Orientation = XL_ROW        # 행 유지
          elif col_field_name is not None and fnm == col_field_name:
              pt.PivotFields(fnm).Orientation = XL_COL        # 열 유지
  ```
  핵심: 재지정해도 **값-데이터 필드는 사라지지 않고**(엑셀이 별개 DataField 로 보유) 행 그룹만 되살아남.

## 검증 (win32com, 더미데이터)
- 수정 로직 복제 재현:
  - `개수:MVNO상품명 + 합계2개` → **11×4** (상품별 8줄 + `MVNO상품명_count` 8·13·11·20·10·18·7·14
    + 수납금액합계 + 단가합계 + 총합계 101). 사용자 스크린샷과 동일.
  - `value=None`(~별 개수) → **11×2** (상품별 + 개수). 정상.

## 회피/작성 팁 (프롬프트 측)
- 근본 수정 전 우회: 건수를 **group_by 열이 아닌 다른 데이터 열**로 세면 행이 유지됨
  (예: `개수:수납금액`). 행 개수 = 건수라 숫자는 동일. (0.7.1 수정 후에는 `개수:MVNO상품명` 도 정상.)

## 관련
- COM 피벗 특성 전반은 win32com Excel 함정(정렬/Resize/Copy 등)과 같은 계열 —
  "COM 동작은 실제 Excel 단위테스트로만 잡힌다"의 또 다른 사례.

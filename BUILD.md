# 빌드 방법 — 배포용 EXE 만들기

AX-Cell 을 배포 가능한 EXE 로 만드는 절차입니다. 결과물은 두 가지이고, 만드는 순서가 정해져 있습니다.

```
build_exe.bat          →  dist\B2B_ver<버전>\          포터블 폴더(파일 5개) + zip
build_single_exe.bat   →  dist\B2B_ver<버전>_single.exe  단일 EXE (위 폴더를 통째로 감싼 것)
```

**단일 EXE 만 필요해도 `build_exe.bat` 을 먼저 돌려야 합니다.** 뒤엣것은 앞엣것이 만든 폴더를 압축해
자기 안에 넣는 래퍼일 뿐이라, 앞 단계 없이는 시작조차 하지 않습니다.

---

## 1. 준비물

빌드 PC 에 아래가 있어야 합니다. **없으면 build_exe.bat 이 시작하자마자 멈춥니다.**

| 필요한 것 | 확인 방법 | 없을 때 |
|---|---|---|
| Windows x64 | — | — |
| Python 3.10+ (PATH 등록) | `python -V` | python.org 설치 시 "Add to PATH" 체크 |
| Node.js (PATH 등록) | `node -v` | 아래 **Node 없이 빌드하기** 참고 |
| C# 컴파일러 | `dir %WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` | Windows 기본 포함(.NET Framework 4). 없으면 .NET Framework 4.x 설치 |
| 인터넷 | — | 폐쇄망은 `OFFLINE_PORTABLE_BUILD.md` 참고 |

### 파이썬 패키지

```bat
python -m pip install pyinstaller pywin32 openpyxl
```

- `pyinstaller` — 없으면 `build_exe.bat` 이 알아서 설치합니다(직접 깔아도 무방).
- `pywin32` · `openpyxl` — **빌드는 이것들 없이도 통과할 수 있지만, 그렇게 만든 EXE 는 Excel 을 못 다룹니다.**
  `launch_b2b.spec` 의 `hiddenimports` 에 `pythoncom` · `win32com` 계열이 들어 있고, 실제 스킬 실행이
  Excel COM 과 openpyxl 을 쓰기 때문입니다. 빌드 전에 반드시 깔아 두세요.

> 확인: 빌드한 EXE 를 실행하고 `http://127.0.0.1:<포트>/api/backend/health` 를 열어
> `"openpyxl": true`, `"excelCom": true`, `"node": true` 세 개가 모두 true 인지 봅니다. 하나라도 false 면
> 그 기능이 배포본에서만 조용히 꺼진 것입니다.

---

## 2. 빌드

저장소 루트에서 **순서대로** 실행합니다. 두 배치 모두 자기 위치를 기준으로 동작하므로
어느 폴더에서 눌러도 됩니다(더블클릭 가능).

```bat
build_exe.bat
build_single_exe.bat
```

### build_exe.bat 이 하는 일

1. `native_host\build_native_host.ps1` — WebView2 패키지(NuGet)를 받아 C# 네이티브 호스트를 컴파일
2. `tools\gen_version_meta.py` — EXE 버전 리소스 생성
3. PyInstaller 로 `B2B_Server.exe` (파이썬 백엔드 + 화면 자산 전부) 빌드
4. 포터블 폴더와 zip 으로 포장

결과:

```text
dist\B2B_ver0.8.1\B2B_ver0.8.1.exe                    네이티브 호스트(사용자가 누르는 것)
dist\B2B_ver0.8.1\B2B_Server.exe                      백엔드
dist\B2B_ver0.8.1\Microsoft.Web.WebView2.Core.dll     WebView2 3종
dist\B2B_ver0.8.1\Microsoft.Web.WebView2.WinForms.dll
dist\B2B_ver0.8.1\WebView2Loader.dll
dist\B2B_ver0.8.1_portable.zip                        위 폴더 압축본
```

### build_single_exe.bat 이 하는 일

위 폴더를 zip 으로 만들어 C# 래퍼 안에 리소스로 넣고, 실행 시 `%TEMP%` 에 풀어 띄우는 EXE 를 만듭니다.

```text
dist\B2B_ver0.8.1_single.exe    ← 배포할 것은 이것 하나면 됩니다
dist\AX-Cell.exe                 같은 파일(컴파일 출력 이름). 배포에는 위 이름을 쓰세요
```

빌드 중 두 가지를 스스로 검사합니다.

- `check_payload_fresh.py` — 포터블 패키지가 소스보다 오래됐으면 **중단**합니다.
  (`build_exe.bat` 없이 돌리면 어제 빌드된 백엔드를 감싼 채 "Build complete" 가 뜨던 사고를 막는 장치)
- `verify_single_exe.py` — 래퍼가 자기 안에서 실행할 EXE 를 실제로 찾는지 확인합니다.

---

## 3. Node 없이 빌드하기 (설치 권한이 없을 때)

`build_exe.bat` 은 `where node` 로 하드 체크하고, `launch_b2b.spec` 은 찾은 `node.exe` 를
`B2B_Server.exe` 안에 번들합니다. 그래서 **PATH 에서 보이기만 하면 되고, 시스템에 설치할 필요는 없습니다.**

1. [nodejs.org](https://nodejs.org/en/download) 에서 **Windows Binary (.zip) x64** 를 받습니다
2. 압축을 풀어 `node.exe` 하나만 아무 폴더에 둡니다 (예: `C:\tools\node\node.exe`)
3. PowerShell 에서 그 폴더를 PATH 앞에 붙이고 배치를 **절대경로로** 호출합니다

```powershell
$env:PATH = "C:\tools\node;$env:PATH"
& cmd.exe /c "C:\...\B2B-ver0.8.0\build_exe.bat"
& cmd.exe /c "C:\...\B2B-ver0.8.0\build_single_exe.bat"
```

> `cmd /c "build_exe.bat"` 처럼 상대경로로 부르면 `is not recognized` 로 실패합니다. 절대경로를 쓰세요.
> 이 방법은 저장소에도 시스템에도 아무것도 남기지 않습니다. (실측: Node v24.20.0)

---

## 4. 버전 올리기

버전의 **단일 진실은 `launch_b2b.py` 의 `CURRENT_VERSION`** 입니다.
`tools\gen_version_meta.py` 가 그 값만 읽어 EXE 파일 속성(파일 버전)을 만듭니다.

함께 고쳐야 하는 곳 — 하나라도 빠뜨리면 새 버전 코드가 옛 이름 폴더로 포장됩니다.

| 파일 | 값 | 쓰이는 곳 |
|---|---|---|
| `launch_b2b.py` | `CURRENT_VERSION` | EXE 버전 리소스 · 업데이트 안내 팝업 |
| `build_exe.bat` | `APP_VERSION` | 패키지 폴더·zip 이름 |
| `build_single_exe.bat` | `APP_VERSION` | 단일 EXE 이름 |
| `build_exe_offline.bat` | `APP_VERSION` | 폐쇄망 빌드 이름 |
| `serve_b2b.py` | `APP_BUILD_STAMP` | `/api/backend/health` 진단 문자열 |
| `patch_notes\vX.Y.Z.txt` | 새로 작성 | 사용자용 업데이트 안내 |

그다음 문서를 코드와 맞춥니다(안 하면 CI 의 OKF 검사가 경고합니다).

```bat
python tools\okf\regen.py
python tools\okf\check_okf.py
```

> **CHANGELOG.md 는 쓰지 않습니다.** 구 numbering(`ver2.0`)에서 멈춰 있고 릴리즈 노트는 `patch_notes\` 를 씁니다.
> **배치 파일은 CRLF 줄바꿈을 유지하세요.** LF 로 바뀌면 단일 빌드가 `'""' is not recognized` 로 죽습니다(2회 실측).

---

## 5. 빌드 없이 실행 (개발 중)

코드를 고치고 확인만 할 때는 빌드가 필요 없습니다. 네이티브 호스트는 폴더에 `B2B_Server.exe` 가
없으면 `python serve_b2b.py` 로 서버를 띄우므로, 정식 경로 그대로 돌아갑니다.

```bat
start_b2b_native.bat
```

처음 실행하면 네이티브 호스트를 자동으로 컴파일합니다(WebView2 패키지 다운로드 포함).
무엇을 고쳤을 때 무엇이 필요한지는 `tools\dev_run.ps1` 이 판단해 알려 줍니다.

| 고친 것 | 필요한 것 |
|---|---|
| `scripts\*.js` · `styles\*.css` · `index.html` | 화면 새로고침만 |
| `serve_b2b.py` 등 파이썬 | 서버 재시작 |
| `native_host\NativeHost.cs` | 재컴파일 (`build_native_host.ps1`) |

---

## 6. 자주 막히는 곳

| 증상 | 원인과 해결 |
|---|---|
| `[ERROR] Node.js is not installed on this build PC.` | 위 **3장** 참고 |
| `[ERROR] 오래된 패키지입니다. build_exe.bat 을 먼저 실행하세요.` | 순서를 지키지 않은 것. `build_exe.bat` 부터 |
| `[ERROR] C# compiler not found` | .NET Framework 4.x 미설치 |
| `Packaged app entry was not found.` | 단일 EXE 가 자기 안의 실행 파일을 못 찾음. `verify_single_exe.py` 가 빌드 때 걸러 주므로, 이 오류가 실행 시점에 났다면 그 검사를 건너뛴 빌드 |
| 배포본에서만 기능이 조용히 꺼짐 | 새 파이썬 모듈을 `launch_b2b.spec` 의 `datas` + `hiddenimports` **양쪽에** 넣었는지 확인. `scripts\` · `styles\` 는 폴더째 수집되므로 추가 작업이 없습니다 |
| 폐쇄망이라 NuGet·pip 이 안 됨 | `OFFLINE_PORTABLE_BUILD.md` 와 `build_exe_offline.bat` |

산출물 `dist\`, `build\`, `build_meta\`, `native_host\bin\`, `native_host\packages\` 는 모두 git 추적 대상이 아닙니다.

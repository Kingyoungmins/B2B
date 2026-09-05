# AXCell Runner ixi-flow 배포 번들 빌드 (Windows 전용)
#
# 사용:
#   .\build_bundle.ps1 -PythonDist C:\dl\cpython-3.11.x-x86_64-pc-windows-msvc-shared-install_only
#   .\build_bundle.ps1 -PythonDist ... -Wheels C:\dl\wheels     # 폐쇄망: 미리 받은 휠로 설치
#
# 산출물: dist\axcell_runner-deploy-<ver>-win64.tar.gz
#   → 배포 PC 에서: ixi-flow integrations install axcell_runner --bundle <tar.gz>
#
# -PythonDist 는 self-contained Python 배포본(예: python-build-standalone 의
# *-install_only 아카이브를 푼 폴더, 안에 python.exe 존재). 시스템 Python 을 가리키지 말 것.
param(
    [Parameter(Mandatory = $true)][string]$PythonDist,
    [string]$Wheels = "",
    [string]$Version = ""      # 비우면 ixi-flow\manifest.toml 의 version (버전 표기 드리프트 방지)
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here "..\..")).Path   # tools\axcell_runner_mcp → repo root

if (-not $Version) {
    $manifestText = Get-Content -Raw (Join-Path $here "ixi-flow\manifest.toml")
    if ($manifestText -notmatch '(?m)^version\s*=\s*"([^"]+)"') { throw "manifest.toml 에서 version 을 읽지 못했습니다" }
    $Version = $Matches[1]
}
Write-Host "bundle version: $Version"

$pyExe = Join-Path $PythonDist "python.exe"
if (-not (Test-Path -LiteralPath $pyExe)) { throw "python.exe 가 없습니다: $pyExe" }

$staging = Join-Path $here "dist\_staging\axcell_runner-deploy-$Version-win64"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

Write-Host "[1/5] python-standalone 복사..."
Copy-Item -Recurse -LiteralPath $PythonDist -Destination (Join-Path $staging "python-standalone")

Write-Host "[2/5] 의존 패키지 설치 (pywin32, openpyxl)..."
$stagedPy = Join-Path $staging "python-standalone\python.exe"
$pipArgs = @("-m", "pip", "install", "--no-warn-script-location", "pywin32", "openpyxl")
if ($Wheels) { $pipArgs += @("--no-index", "--find-links", $Wheels) }
# [리뷰 2026-09-01] pip 는 정상 성공에도 stderr 로 경고(NOTICE 등)를 쓴다 — EAP=Stop 이면
# 그 한 줄이 NativeCommandError 로 터져 성공 설치가 빌드 실패로 둔갑한다(실측). 종료코드로만 판정.
$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
& $stagedPy @pipArgs 2>&1 | ForEach-Object { "$_" } | Write-Host
$pipExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
if ($pipExit -ne 0) { throw "pip install 실패" }

Write-Host "[3/5] 소스/엔진/매니페스트 복사..."
# axcell_runner 패키지 (+ 엔진 serve_b2b.py 를 패키지 안 engine/ 으로)
Copy-Item -Recurse (Join-Path $here "axcell_runner") (Join-Path $staging "axcell_runner")
New-Item -ItemType Directory -Force -Path (Join-Path $staging "axcell_runner\engine") | Out-Null
Copy-Item (Join-Path $repo "serve_b2b.py") (Join-Path $staging "axcell_runner\engine\serve_b2b.py")
Copy-Item -Recurse (Join-Path $here "ixi-flow") (Join-Path $staging "ixi-flow")
Copy-Item -Recurse (Join-Path $here "skills")  (Join-Path $staging "skills")
Copy-Item (Join-Path $here "install_manual.ps1") (Join-Path $staging "install_manual.ps1")
Get-ChildItem -Recurse (Join-Path $staging "axcell_runner") -Filter "__pycache__" -Directory |
    Remove-Item -Recurse -Force

Write-Host "[4/5] 번들 자체 검증 (BOM / self-check)..."
# 텍스트 파일 BOM 검사 — ixi-flow 설치기가 BOM 있는 SKILL.md 에서 깨진 실사고 방지
# [리뷰 2026-09-01] 스캔 범위를 우리 파일로 한정 — python-standalone(표준 라이브러리의 BOM
# 테스트 픽스처 포함)과 engine/serve_b2b.py(원래 BOM 유지 파일)까지 훑으면 빌드가 오탐으로
# 죽는다. BOM 금지 계약은 ixi-flow 가 파싱하는 우리 텍스트에만 적용된다.
$scanRoots = @((Join-Path $staging "axcell_runner"), (Join-Path $staging "ixi-flow"),
               (Join-Path $staging "skills"), (Join-Path $staging "install_manual.ps1"))
$textFiles = Get-ChildItem -Recurse $scanRoots -Include *.md, *.toml, *.py, *.ps1 -File |
    Where-Object { $_.FullName -notlike "*\engine\*" }
foreach ($f in $textFiles) {
    $b = [System.IO.File]::ReadAllBytes($f.FullName)
    if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) {
        throw "BOM 발견 (제거 필요): $($f.FullName)"
    }
}
# 런타임 self-check (설치 훅과 동일)
$env:PYTHONPATH = $staging
$env:AXCELL_RUNNER_ENGINE_DIR = Join-Path $staging "axcell_runner\engine"
$env:PYTHONUTF8 = "1"
# [리뷰 2026-09-01] 네이티브 stderr 는 EAP=Stop 에서 NativeCommandError 로 터져 아래
# 친절한 실패 문구가 영영 안 나온다 → 호출 동안만 Continue. 그리고 $check 는 여러 줄이면
# 배열이라 -notmatch 가 '필터'로 동작(성공을 실패로 오판) → 한 문자열로 합쳐 비교한다.
$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$check = & $stagedPy -c "import win32com.client, axcell_runner.runner_core as c; c._engine(); print('OK')" 2>&1
$ErrorActionPreference = $prevEAP
$checkText = ($check | Out-String)
if ($LASTEXITCODE -ne 0 -or $checkText -notmatch "OK") { throw "self-check 실패: $checkText" }

Write-Host "[5/5] tar.gz 생성..."
$distDir = Join-Path $here "dist"
$tarPath = Join-Path $distDir "axcell_runner-deploy-$Version-win64.tar.gz"
if (Test-Path $tarPath) { Remove-Item -Force $tarPath }
# Windows 10 1803+ 내장 bsdtar
Push-Location (Split-Path $staging)
try {
    tar -czf $tarPath (Split-Path $staging -Leaf)
    if ($LASTEXITCODE -ne 0) { throw "tar 실패" }
} finally { Pop-Location }

Write-Host ""
Write-Host "완료: $tarPath"
Write-Host "설치: ixi-flow integrations install axcell_runner --bundle `"$tarPath`""

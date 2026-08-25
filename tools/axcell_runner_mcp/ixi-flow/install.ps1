# AXCell Runner 설치 훅 — ixi-flow 설치기가 압축 해제된 번들 루트를 인자로 호출한다.
# 멱등: 검증만 하고 아무것도 변경하지 않는다(부분 설치 상태를 만들지 않음).
# 폐쇄망 전제: 네트워크 접근 금지.
param(
    [Parameter(Mandatory = $true)][string]$BundleRoot
)
$ErrorActionPreference = "Stop"

function Fail([string]$msg) { Write-Error "[axcell_runner-install] $msg"; exit 1 }

$py = Join-Path $BundleRoot "python-standalone\python.exe"
if (-not (Test-Path -LiteralPath $py)) { Fail "python-standalone\python.exe 가 없습니다: $py" }

$engine = Join-Path $BundleRoot "axcell_runner\engine\serve_b2b.py"
if (-not (Test-Path -LiteralPath $engine)) { Fail "엔진(serve_b2b.py)이 없습니다: $engine" }

# 런타임 self-check: 표준 import + 엔진 로드 + pywin32
$env:PYTHONPATH = $BundleRoot
$env:AXCELL_RUNNER_ENGINE_DIR = Join-Path $BundleRoot "axcell_runner\engine"
$env:PYTHONUTF8 = "1"
$check = & $py -c "import win32com.client, axcell_runner.runner_core as c; c._engine(); print('OK')" 2>&1
if ($LASTEXITCODE -ne 0 -or ($check -notmatch "OK")) {
    Fail "런타임 self-check 실패 (pywin32/엔진 로드): $check"
}

# Excel 은 실행 시점 요구사항 — 설치는 막지 않고 경고만
try {
    $excel = Get-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Excel.Application\CurVer" -ErrorAction Stop
    Write-Host "[axcell_runner-install] Excel 감지: $($excel.'(default)')"
} catch {
    Write-Warning "[axcell_runner-install] Excel 이 감지되지 않습니다. 스킬 실행(run_start)에는 Excel 설치가 필요합니다."
}

Write-Host "[axcell_runner-install] OK"
exit 0

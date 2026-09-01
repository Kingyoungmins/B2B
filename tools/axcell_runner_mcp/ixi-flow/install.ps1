# AXCell Runner install hook — invoked by ixi-flow integrations installer.
#
# Actual contract (per ixi-flow gca/mod.rs run_install_hook):
#   - Called with NO arguments; current dir = bundle root. We derive the root
#     from this script's location instead (more robust than cwd).
#   - stdout's trailing KEY=VALUE block is parsed by the installer; it expects
#     IXI_PY (python path). IXI_VENDOR defaults to bundle root if omitted, but
#     we emit it explicitly. Diagnostics must go to stderr, not stdout.
#   - Idempotent, verification-only, no network (closed-network premise).
# NOTE: ASCII-only on purpose — Windows PowerShell 5.1 reads BOM-less UTF-8
#       as ANSI and garbles non-ASCII text (observed in the field).
$ErrorActionPreference = "Stop"

function Diag([string]$msg) { [Console]::Error.WriteLine("[axcell_runner-hook] $msg") }
function Fail([string]$msg) { Diag $msg; exit 1 }

$root = Split-Path -Parent $PSScriptRoot   # <bundle_root>/ixi-flow/install.ps1 -> <bundle_root>
$py = Join-Path $root "python-standalone\python.exe"
if (-not (Test-Path -LiteralPath $py)) { Fail "python-standalone\python.exe not found: $py" }

$engine = Join-Path $root "axcell_runner\engine\serve_b2b.py"
if (-not (Test-Path -LiteralPath $engine)) { Fail "engine (serve_b2b.py) not found: $engine" }

# Runtime self-check: pywin32 + engine load
$env:PYTHONPATH = $root
$env:AXCELL_RUNNER_ENGINE_DIR = Join-Path $root "axcell_runner\engine"
$env:PYTHONUTF8 = "1"
# [리뷰 2026-09-01] 네이티브 stderr 는 EAP=Stop 에서 NativeCommandError 로 터져 아래
# 친절한 실패 문구가 영영 안 나온다 → 호출 동안만 Continue. 그리고 $check 는 여러 줄이면
# 배열이라 -notmatch 가 '필터'로 동작(성공을 실패로 오판) → 한 문자열로 합쳐 비교한다.
$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$check = & $py -c "import win32com.client, axcell_runner.runner_core as c; c._engine(); print('OK')" 2>&1
$ErrorActionPreference = $prevEAP
$checkText = ($check | Out-String)
if ($LASTEXITCODE -ne 0 -or $checkText -notmatch "OK") { Fail "runtime self-check failed: $checkText" }
Diag "self-check OK"

# Excel is a runtime requirement, not an install requirement — warn only.
try {
    $null = Get-ItemProperty -Path "HKLM:\SOFTWARE\Classes\Excel.Application\CurVer" -ErrorAction Stop
} catch {
    Diag "WARNING: Excel not detected. run_start requires Excel on this PC."
}

# Trailing KEY=VALUE block consumed by the installer (keep last, keep clean).
Write-Output "IXI_PY=$py"
Write-Output "IXI_VENDOR=$root"
exit 0

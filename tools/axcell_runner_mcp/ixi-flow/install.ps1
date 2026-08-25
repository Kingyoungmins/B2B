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
$check = & $py -c "import win32com.client, axcell_runner.runner_core as c; c._engine(); print('OK')" 2>&1
if ($LASTEXITCODE -ne 0 -or ($check -notmatch "OK")) { Fail "runtime self-check failed: $check" }
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

# AXCell Runner 수동 설치기 (Windows)
#
# 배경: 현재 ixi-flow 의 `integrations install` 은 gca 전용(src/integrations/mod.rs 하드코딩)이라
# 범용 번들 설치가 아직 안 된다. 이 스크립트는 gca 설치기가 하는 일을 그대로 수행한다:
#   1) 번들 압축 해제  2) 런타임 self-check  3) config.toml 에 관리 블록(마커) 렌더링
#   4) 스킬을 workspace/skills/ 에 배포
# 멱등: 재실행하면 기존 관리 블록/스킬을 교체한다. 관리 블록 밖 사용자 설정은 건드리지 않는다.
#
# 사용:
#   .\install_manual.ps1 -Bundle .\dist\axcell_runner-deploy-0.2.0-win64.tar.gz
#   .\install_manual.ps1 -BundleRoot C:\ixi\axcell_runner\axcell_runner-deploy-0.2.0-win64   # 이미 풀린 경우
# 옵션: -IxiHome (기본 %USERPROFILE%\.ixi-flow) / -InstallDir (기본 <IxiHome>\integrations\axcell_runner)
param(
    [string]$Bundle = "",
    [string]$BundleRoot = "",
    [string]$InstallDir = "",
    [string]$IxiHome = "$env:USERPROFILE\.ixi-flow"
)
$ErrorActionPreference = "Stop"
$MARKER_BEGIN = "# >>> ixi-flow integrations:axcell_runner >>>"
$MARKER_END   = "# <<< ixi-flow integrations:axcell_runner <<<"

function Fail([string]$msg) { Write-Error "[axcell_runner-install] $msg"; exit 1 }
function Info([string]$msg) { Write-Host "[axcell_runner-install] $msg" }

# ── 1) 번들 확보 ─────────────────────────────────────────────────────────────
if (-not $BundleRoot) {
    if (-not $Bundle) { Fail "-Bundle <tar.gz> 또는 -BundleRoot <풀린 폴더> 를 지정하세요." }
    if (-not (Test-Path -LiteralPath $Bundle)) { Fail "번들이 없습니다: $Bundle" }
    if (-not $InstallDir) { $InstallDir = Join-Path $IxiHome "integrations\axcell_runner" }
    if (Test-Path -LiteralPath $InstallDir) {
        Info "기존 설치 제거: $InstallDir"
        Remove-Item -Recurse -Force -LiteralPath $InstallDir
    }
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Info "압축 해제 중... ($Bundle)"
    tar -xzf (Resolve-Path -LiteralPath $Bundle).Path -C $InstallDir
    if ($LASTEXITCODE -ne 0) { Fail "tar 압축 해제 실패" }
    # 래핑 폴더 1겹(axcell_runner-deploy-*-win64) 해석
    $inner = Get-ChildItem -LiteralPath $InstallDir -Directory | Select-Object -First 1
    if ($inner -and (Test-Path (Join-Path $inner.FullName "ixi-flow\manifest.toml"))) {
        $BundleRoot = $inner.FullName
    } elseif (Test-Path (Join-Path $InstallDir "ixi-flow\manifest.toml")) {
        $BundleRoot = $InstallDir
    } else {
        Fail "압축 해제 결과에서 ixi-flow\manifest.toml 을 찾지 못했습니다."
    }
}
$BundleRoot = (Resolve-Path -LiteralPath $BundleRoot).Path
Info "번들 루트: $BundleRoot"

$py = Join-Path $BundleRoot "python-standalone\python.exe"
if (-not (Test-Path -LiteralPath $py)) { Fail "python-standalone\python.exe 가 없습니다: $py" }

# ── 2) 런타임 self-check ─────────────────────────────────────────────────────
$env:PYTHONPATH = $BundleRoot
$env:AXCELL_RUNNER_ENGINE_DIR = Join-Path $BundleRoot "axcell_runner\engine"
$env:PYTHONUTF8 = "1"
# [리뷰 2026-09-01] 네이티브 stderr 는 EAP=Stop 에서 NativeCommandError 로 터져 아래
# 친절한 실패 문구가 영영 안 나온다 → 호출 동안만 Continue. 그리고 $check 는 여러 줄이면
# 배열이라 -notmatch 가 '필터'로 동작(성공을 실패로 오판) → 한 문자열로 합쳐 비교한다.
$prevEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
$check = & $py -c "import win32com.client, axcell_runner.runner_core as c; c._engine(); print('OK')" 2>&1
$ErrorActionPreference = $prevEAP
$checkText = ($check | Out-String)
if ($LASTEXITCODE -ne 0 -or $checkText -notmatch "OK") { Fail "런타임 self-check 실패: $checkText" }
Info "self-check OK"

# ── 3) config.toml 관리 블록 렌더링 ──────────────────────────────────────────
$configPath = Join-Path $IxiHome "config.toml"
if (-not (Test-Path -LiteralPath $configPath)) { Fail "config.toml 이 없습니다: $configPath (ixi-flow 를 먼저 초기화하세요)" }
$config = [System.IO.File]::ReadAllText($configPath)

# 기존 관리 블록 제거(멱등)
$beginIdx = $config.IndexOf($MARKER_BEGIN)
if ($beginIdx -ge 0) {
    $endIdx = $config.IndexOf($MARKER_END, $beginIdx)
    if ($endIdx -lt 0) { Fail "config.toml 의 관리 블록이 손상됐습니다(END 마커 없음). 수동 정리 후 재실행하세요." }
    $config = $config.Substring(0, $beginIdx) + $config.Substring($endIdx + $MARKER_END.Length)
    $config = $config.TrimEnd() + "`n"
    Info "기존 관리 블록 교체"
}

# [mcp] enabled 보장 (없을 때만 추가 — 있으면 사용자 설정 존중)
if ($config -notmatch "(?m)^\[mcp\]") {
    $config = $config.TrimEnd() + "`n`n[mcp]`nenabled = true`n"
    Info "[mcp] enabled = true 추가"
} elseif ($config -match "(?m)^\s*enabled\s*=\s*false") {
    Write-Warning "[axcell_runner-install] config 에 enabled = false 가 보입니다 — [mcp] 섹션이 꺼져 있으면 도구가 노출되지 않습니다."
}

# 관리 블록 (경로는 TOML literal string — 백슬래시 이스케이프 불필요)
$engineDir = Join-Path $BundleRoot "axcell_runner\engine"
$block = @"
$MARKER_BEGIN
[[mcp.servers]]
name = "axcell_runner"
transport = "stdio"
command = '$py'
args = ["-m", "axcell_runner.mcp_server"]
tool_timeout_secs = 120

[mcp.servers.env]
PYTHONPATH = '$BundleRoot'
AXCELL_RUNNER_ENGINE_DIR = '$engineDir'
PYTHONUTF8 = "1"

[mcp.servers.background_runs]
start_tools  = ["run_start"]
end_tools    = ["run_stop"]
status_tools = ["run_report"]
id_fields    = ["run_id"]
label_fields = ["skill", "title"]
progress_fields         = ["step"]
total_fields            = ["total_steps"]
progress_context_fields = ["step_label"]
poll_interval_secs  = 5
status_timeout_arg  = "max_wait_seconds"
status_timeout_secs = 0
terminal_markers = ["completed", "failed", "cancelled"]
status_errors_terminal_after = 3
event_cursor_arg  = "after_cursor"
event_limit_arg   = "max_events"
event_include_arg = "include_events"
drives_browser = false
display_name   = "스킬 실행기"
$MARKER_END
"@
$config = $config.TrimEnd() + "`n`n" + $block + "`n"
# BOM 없는 UTF-8 로 저장 (BOM 이 붙으면 toml 파서가 깨진다)
$backup = "$configPath.bak"
Copy-Item -LiteralPath $configPath -Destination $backup -Force
[System.IO.File]::WriteAllText($configPath, $config, (New-Object System.Text.UTF8Encoding($false)))
Info "config.toml 갱신 (백업: $backup)"

# ── 4) 스킬 배포 ─────────────────────────────────────────────────────────────
$skillSrc = Join-Path $BundleRoot "skills\axcell-runner-guide"
$skillDst = Join-Path $IxiHome "workspace\skills\axcell-runner-guide"
if (Test-Path -LiteralPath $skillSrc) {
    if (Test-Path -LiteralPath $skillDst) { Remove-Item -Recurse -Force -LiteralPath $skillDst }
    New-Item -ItemType Directory -Force -Path (Split-Path $skillDst) | Out-Null
    Copy-Item -Recurse -LiteralPath $skillSrc -Destination $skillDst
    Info "스킬 배포: $skillDst"
} else {
    Write-Warning "[axcell_runner-install] 번들에 스킬이 없습니다: $skillSrc"
}

Write-Host ""
Write-Host "  ✓ axcell_runner 설치 완료" -ForegroundColor Green
Write-Host "    bundle : $BundleRoot"
Write-Host "    config : $configPath"
Write-Host "    skill  : $skillDst"
Write-Host ""
Write-Host "  다음: ixi-flow 를 재시작하면 axcell_runner__* 도구가 노출됩니다."
Write-Host "  확인: ixi-flow agent -m `"tool_search로 axcell_runner 도구 찾아`""

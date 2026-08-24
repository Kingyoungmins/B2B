<#
  소스 모드 개발 실행기 — 빌드 없이 지금 소스 그대로 띄우고, 뭐가 반영됐는지까지 확인해 준다.

  왜 필요한가
    네이티브 호스트는 폴더에 B2B_Server.exe 가 있으면 프로즌으로, 없으면 python serve_b2b.py 로
    서버를 띄운다. 즉 빌드하지 않아도 정식 경로로 그대로 돌아간다(PyInstaller 수 분 + 메모리 피크가
    통째로 빠진다 — 4코어/12GB 환경에서 체감이 크다).
    문제는 매번 프로세스를 찾고 포트를 뒤져야 한다는 것. 그걸 없앤다.

  무엇이 언제 필요한가 (이 스크립트가 알아서 판단해 알려 준다)
    scripts/*.js, styles/*.css, index.html  → 재시작 불필요. 화면 새로고침이면 끝.
    serve_b2b.py                            → 서버 재시작 필요(-Restart)
    native_host/NativeHost.cs               → 재컴파일 필요(-Build 가 자동으로 한다)

  사용법
    tools\dev_run.ps1              현재 상태 점검 + 안 떠 있으면 띄운다
    tools\dev_run.ps1 -Restart     껐다 다시 띄운다(백엔드 수정 반영)
    tools\dev_run.ps1 -Build       NativeHost.cs 가 exe 보다 새로우면 재컴파일 후 띄운다
    tools\dev_run.ps1 -Stop        전부 정리
    tools\dev_run.ps1 -Check       띄우지 않고 상태만 본다(포트/반영 여부)
#>
[CmdletBinding()]
param(
  [switch]$Restart,
  [switch]$Build,
  [switch]$Stop,
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$HostExe = Join-Path $Root "native_host\bin\B2B_NativeHost.exe"
$HostSrc = Join-Path $Root "native_host\NativeHost.cs"
$BuildPs = Join-Path $Root "native_host\build_native_host.ps1"

function Say($msg, $color = "Gray") { Write-Host $msg -ForegroundColor $color }

function Get-B2bProcs {
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like "*B2B*" -or $_.ProcessName -eq "python" -or $_.ProcessName -eq "pythonw" }
}

function Get-B2bPort {
  # 우리가 띄운 프로세스가 LISTEN 중인 포트만 고른다(다른 파이썬 서버와 섞이지 않게).
  $procs = Get-B2bProcs
  if (-not $procs) { return $null }
  $ids = $procs.Id
  $conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
             Where-Object { $ids -contains $_.OwningProcess }
  foreach ($c in ($conns | Sort-Object LocalPort -Unique)) {
    try {
      $r = Invoke-WebRequest "http://127.0.0.1:$($c.LocalPort)/" -TimeoutSec 5 -UseBasicParsing
      if ($r.StatusCode -eq 200 -and $r.Content -match "B2B|AX-Cell|chat-text") { return $c.LocalPort }
    } catch { }
  }
  return $null
}

function Stop-B2b {
  $p = Get-B2bProcs | Where-Object { $_.ProcessName -like "*B2B*" }
  if (-not $p) { Say "  실행 중인 B2B 없음" ; return }
  foreach ($x in $p) {
    try { Stop-Process -Id $x.Id -Force -ErrorAction Stop; Say "  종료: $($x.ProcessName) ($($x.Id))" }
    catch { Say "  종료 실패: $($x.ProcessName)" "Yellow" }
  }
  Start-Sleep -Seconds 2
}

function Assert-SourceMode {
  # rootDir 에 B2B_Server.exe 가 있으면 호스트가 그걸 쓴다 = 소스 수정이 반영되지 않는다.
  # 실제로 '고쳤는데 앱은 그대로'의 단골 원인이라 먼저 잡아 준다.
  $frozen = Join-Path $Root "B2B_Server.exe"
  if (Test-Path $frozen) {
    Say "  [경고] rootDir 에 B2B_Server.exe 가 있습니다 — 소스가 아니라 이 exe 로 뜹니다." "Red"
    Say "         소스로 테스트하려면 이 파일을 옮기거나 지우세요: $frozen" "Red"
    return $false
  }
  Say "  소스 모드 OK (B2B_Server.exe 없음 → python serve_b2b.py 로 뜬다)" "Green"
  return $true
}

function Show-Freshness($port) {
  # 프론트는 디스크에서 바로 나간다 — 서버가 언제 떴든 파일이 최신이면 최신이 나간다.
  # 그 사실을 '실제로 받아 보고' 확인해 준다(추측하지 않는다).
  Say ""
  Say "── 반영 상태 ─────────────────────────────" "Cyan"
  $srv = Get-B2bProcs | Where-Object { $_.ProcessName -eq "python" } | Sort-Object StartTime -Descending | Select-Object -First 1
  $pySrc = Join-Path $Root "serve_b2b.py"
  if ($srv) {
    $pyNewer = (Get-Item $pySrc).LastWriteTime -gt $srv.StartTime
    if ($pyNewer) {
      Say "  serve_b2b.py 가 서버 기동 이후 수정됨 → 백엔드 미반영. -Restart 필요" "Yellow"
    } else {
      Say "  serve_b2b.py: 반영됨 (서버 기동 $($srv.StartTime.ToString('HH:mm:ss')))" "Green"
    }
  }
  if ((Test-Path $HostSrc) -and (Test-Path $HostExe)) {
    if ((Get-Item $HostSrc).LastWriteTime -gt (Get-Item $HostExe).LastWriteTime) {
      Say "  NativeHost.cs 가 exe 보다 새로움 → 재컴파일 필요. -Build 로 실행하세요" "Yellow"
    } else {
      Say "  NativeHost.exe: 최신" "Green"
    }
  }
  # 프론트 — 디스크 파일과 서버가 내보내는 바이트 수를 대조한다.
  foreach ($rel in @("scripts\pipeline.js", "scripts\excel-mirror.js", "scripts\chat-ui.js", "styles\chat.css")) {
    $disk = Join-Path $Root $rel
    if (-not (Test-Path $disk)) { continue }
    $url = "http://127.0.0.1:$port/" + ($rel -replace "\\", "/")
    try {
      $served = (Invoke-WebRequest $url -TimeoutSec 8 -UseBasicParsing).RawContentLength
      $onDisk = (Get-Item $disk).Length
      # 인코딩 차이로 몇 바이트 어긋날 수 있어 근사 비교한다.
      $ok = [Math]::Abs($served - $onDisk) -le [Math]::Max(64, $onDisk * 0.01)
      $tag = if ($ok) { "일치" } else { "다름(캐시 의심 — 화면 새로고침)" }
      $col = if ($ok) { "Green" } else { "Yellow" }
      Say ("  {0,-26} 디스크 {1,8}B / 서버 {2,8}B  {3}" -f $rel, $onDisk, $served, $tag) $col
    } catch { Say "  $rel  조회 실패" "Yellow" }
  }
  Say "───────────────────────────────────────────" "Cyan"
}

# ── 실행 ────────────────────────────────────────────────────────────────
Say ""
Say "AX-Cell 소스 모드 실행기  ($Root)" "White"

if ($Stop) { Say ""; Stop-B2b; Say ""; exit 0 }

if ($Build) {
  if ((Test-Path $HostSrc) -and (Test-Path $HostExe) -and
      ((Get-Item $HostSrc).LastWriteTime -le (Get-Item $HostExe).LastWriteTime)) {
    Say "  NativeHost 재컴파일 불필요(이미 최신)" "Green"
  } else {
    Say "  NativeHost 재컴파일 중..." "Cyan"
    Stop-B2b   # exe 가 잠겨 있으면 컴파일이 실패한다
    & powershell -NoProfile -ExecutionPolicy Bypass -File $BuildPs | Select-Object -Last 2
    if ($LASTEXITCODE -ne 0) { Say "  재컴파일 실패 — 중단합니다" "Red"; exit 1 }
  }
}

$running = Get-B2bProcs | Where-Object { $_.ProcessName -like "*B2B*" }

if ($Restart -and $running) { Say ""; Say "  재시작 — 기존 인스턴스 정리" "Cyan"; Stop-B2b; $running = $null }

if ($Check) {
  Say ""
  if (-not $running) { Say "  실행 중이 아닙니다." "Yellow"; exit 0 }
  $port = Get-B2bPort
  if ($port) { Say "  실행 중 · 포트 $port" "Green"; Show-Freshness $port }
  else { Say "  프로세스는 있는데 응답 포트를 못 찾았습니다(기동 중일 수 있음)" "Yellow" }
  exit 0
}

if (-not $running) {
  Say ""
  if (-not (Assert-SourceMode)) { exit 1 }
  if (-not (Test-Path $HostExe)) { Say "  네이티브 호스트가 없습니다 — -Build 로 먼저 컴파일하세요" "Red"; exit 1 }
  Say "  기동 중..." "Cyan"
  Start-Process -FilePath $HostExe | Out-Null
  # 서버가 포트를 열 때까지 기다린다(고정 sleep 대신 실제 응답을 본다).
  $port = $null
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    $port = Get-B2bPort
    if ($port) { break }
  }
  if (-not $port) { Say "  80초 안에 응답이 없습니다 — 로그를 확인하세요(%LOCALAPPDATA%\B2B_logs)" "Red"; exit 1 }
  Say "  기동 완료 · 포트 $port" "Green"
} else {
  $port = Get-B2bPort
  Say ""
  if ($port) { Say "  이미 실행 중 · 포트 $port" "Green" }
  else { Say "  프로세스는 있는데 포트를 못 찾았습니다" "Yellow"; exit 1 }
}

Show-Freshness $port
Say ""
Say "  화면: http://127.0.0.1:$port/   (프론트 수정은 새로고침이면 반영)" "White"
Say "  정리: tools\dev_run.ps1 -Stop" "Gray"
Say ""

@echo off & setlocal
REM b2b_run_ps.bat - external runner for B2B billing agent (PowerShell, no Python needed).
REM  This .bat body is PURE ASCII on purpose: cmd.exe reads .bat in the OEM codepage
REM  and mangles UTF-8 Korean, so all Korean docs live AFTER the marker (in the PS body,
REM  which cmd never parses - only powershell reads it as UTF-8).
REM  Usage / options are documented at the top of the PowerShell body below.
set "B2BSELF=%~f0"
set "B2BPS=%TEMP%\b2brun_%RANDOM%%RANDOM%.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$a=Get-Content -LiteralPath $env:B2BSELF -Encoding UTF8; $i=(1..$a.Count | Where-Object { $a[$_-1] -like ':: __B2BPSBODY__*' } | Select-Object -First 1); ($a | Select-Object -Skip $i) | Set-Content -LiteralPath $env:B2BPS -Encoding UTF8"
powershell -NoProfile -ExecutionPolicy Bypass -File "%B2BPS%" %*
set "B2BRC=%ERRORLEVEL%"
del "%B2BPS%" >nul 2>&1
exit /b %B2BRC%

:: __B2BPSBODY__
# ==========================================================================
#  b2b_run_ps.bat  —  이미 떠 있는 B2B_ver0.6.x.exe 를 외부에서 API 처럼 호출
#  (PowerShell 기반 — Windows 기본 내장이라 Python 설치가 필요 없다)
#
#  사용:
#    b2b_run_ps.bat -Skill 스킬.zip -Inputs 입력.xlsx [-Output 템플릿.xlsx] -OutZip 결과.zip
#    b2b_run_ps.bat -Skill s.zip -Inputs a.xlsx,b.xlsx -OutZip out.zip   (다입력: 스킬 입력 순서대로)
#    b2b_run_ps.bat -Skill s.zip -Inputs "청구내역.xlsx=C:\경로.xlsx" -OutZip out.zip  (명시 매핑)
#  옵션: -Port N / -Timeout S(기본1800) / -KeepOpen / -DryRun / -ProgressJson
#  진행률: 실행 중 stderr 에 '진행 3/5 단계 (60%)' 를 실시간 출력(stdout 은 최종 JSON 만).
#  결과: stdout 마지막 줄에 JSON 한 줄 {ok, outZip, files, port}. OpenClaw 는 이걸 파싱.
#  주의: 결과 zip 에는 '값이 바뀐 파일'만 담긴다(읽기만 한 입력은 원본과 동일 → 미포함).
# ==========================================================================
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Skill,
  [Parameter(Mandatory=$true)][string[]]$Inputs,
  [string]$Output = $null,
  [Parameter(Mandatory=$true)][string]$OutZip,
  [int]$Port = 0,
  [int]$Timeout = 1800,
  [switch]$KeepOpen,
  [switch]$DryRun,
  [switch]$ProgressJson
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

# 서버가 뜰 수 있는 포트 후보(네이티브 셸 18120~, 단독 launcher 8090/18090~).
$PORT_CANDIDATES = @(18120,18121,18122,18123,18124,18125,18126,18127,8090,18090,18091,18092,18093,18094,18095)

function Log([string]$m) { [Console]::Error.WriteLine("[b2b_run] $m") }

function Emit-Result($obj) {
  # 결과 JSON 한 줄을 stdout 으로(UTF-8). OpenClaw 는 이 마지막 줄을 파싱한다.
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Depth 30 -Compress))
}
function Fail([string]$msg, $extra=$null) {
  $o = [ordered]@{ ok = $false; error = $msg }
  if ($extra) { foreach ($k in $extra.Keys) { $o[$k] = $extra[$k] } }
  Emit-Result $o
  exit 1
}

function Api-PostJson($base, $path, $obj, $timeoutSec) {
  $body = ($obj | ConvertTo-Json -Depth 30 -Compress)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  return Invoke-RestMethod -Uri "$base$path" -Method Post -Body $bytes `
      -ContentType "application/json" -TimeoutSec $timeoutSec
}
function Api-Upload($base, $name, [byte[]]$bytes) {
  $enc = [uri]::EscapeDataString($name)
  return Invoke-RestMethod -Uri "$base/api/workbooks/upload?name=$enc" -Method Post `
      -Body $bytes -ContentType "application/octet-stream" -TimeoutSec 120
}
function Api-GetBytes($base, $path) {
  $wc = New-Object System.Net.WebClient
  try { return $wc.DownloadData("$base$path") } finally { $wc.Dispose() }
}

function Discover-Port() {
  $cands = if ($Port -gt 0) { @($Port) } else { $PORT_CANDIDATES }
  foreach ($p in $cands) {
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1:$p/api/backend/health" -TimeoutSec 3
      if ($h -and $h.ok) { Log ("서버 발견: port {0} (build {1})" -f $p, $h.buildStamp); return $p }
    } catch {}
  }
  Fail "실행 중인 B2B 서버를 찾지 못했습니다. 프로그램(B2B_ver0.6.x.exe)이 켜져 있는지 확인하세요." `
       @{ triedPorts = $cands }
}

function Read-Skill([string]$zipPath) {
  if (-not (Test-Path -LiteralPath $zipPath)) { Fail "스킬 zip 을 찾을 수 없습니다: $zipPath" }
  $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $zipPath).Path)
  try {
    $entry = $zip.Entries | Where-Object { $_.FullName -like "*.logic.json" } | Select-Object -First 1
    if (-not $entry) { Fail "스킬 zip 안에 .logic.json 이 없습니다(올바른 스킬 zip 인지 확인)." }
    $sr = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    try { $json = $sr.ReadToEnd() } finally { $sr.Dispose() }
  } finally { $zip.Dispose() }
  $data = $json | ConvertFrom-Json

  # v4 핸들맵: @@FILE_n@@ → 실제(원본) 파일명
  $handleMap = @{}
  if ($data.PSObject.Properties.Name -contains "requiredFiles" -and $data.requiredFiles) {
    foreach ($rf in $data.requiredFiles) {
      if ($rf.handle -and $rf.name) { $handleMap[$rf.handle] = $rf.name }
    }
  }
  function Restore-Code([string]$code) {
    $c = [string]$code
    foreach ($h in $handleMap.Keys) { $c = $c.Replace($h, $handleMap[$h]) }
    return $c
  }

  $steps = New-Object System.Collections.ArrayList
  $inputOrder = New-Object System.Collections.ArrayList
  $seenIn = @{}
  if ($data.pipeline) {
    $idx = 0
    foreach ($s in $data.pipeline) {
      if ($s.PSObject.Properties.Name -contains "enabled" -and $s.enabled -eq $false) { continue }
      $code = Restore-Code $s.code
      if (-not $code -or -not $code.Trim()) { continue }
      $tid = [string]$s.targetFileId
      $sheet = $null
      if ($s.PSObject.Properties.Name -contains "targetSheetName" -and $s.targetSheetName) { $sheet = $s.targetSheetName }
      elseif ($s.PSObject.Properties.Name -contains "targetSheet" -and $s.targetSheet) { $sheet = $s.targetSheet }
      $lang = if ($s.language) { [string]$s.language } else { "python" }
      $sid = if ($s.id) { [string]$s.id } else { "s$idx" }
      [void]$steps.Add([pscustomobject]@{ id=$sid; code=$code; language=$lang; targetFileId=$tid; targetSheetName=$sheet })
      if ($tid -like "input:*") {
        $nm = $tid.Substring(6)
        if (-not $seenIn.ContainsKey($nm)) { $seenIn[$nm] = $true; [void]$inputOrder.Add($nm) }
      }
      $idx++
    }
  }
  # v4 requiredFiles(role=input) 가 입력 순서의 더 정확한 근거 — 있으면 우선
  $rfInputs = @()
  if ($data.requiredFiles) {
    $rfInputs = @($data.requiredFiles | Where-Object { $_.role -eq "input" -and $_.name } | ForEach-Object { $_.name })
  }
  if ($rfInputs.Count -gt 0) {
    $merged = New-Object System.Collections.ArrayList
    foreach ($n in $rfInputs) { [void]$merged.Add($n) }
    foreach ($n in $inputOrder) { if ($rfInputs -notcontains $n) { [void]$merged.Add($n) } }
    $inputOrder = $merged
  }
  if ($steps.Count -eq 0) { Fail "스킬에 실행할 단계가 없습니다." }
  $nm = if ($data.name) { [string]$data.name } else { [System.IO.Path]::GetFileName($zipPath) }
  return [pscustomobject]@{ steps=$steps; inputs=@($inputOrder); name=$nm }
}

function Parse-Inputs([string[]]$inputArgs, [string[]]$skillInputs) {
  $explicit = [ordered]@{}
  $positional = New-Object System.Collections.ArrayList
  foreach ($a in $inputArgs) {
    $eq = $a.IndexOf("=")
    if ($eq -gt 0 -and -not (Test-Path -LiteralPath $a)) {
      $k = $a.Substring(0, $eq).Trim()
      $v = $a.Substring($eq + 1).Trim()
      $explicit[$k] = $v
    } else { [void]$positional.Add($a) }
  }
  $mapping = [ordered]@{}
  foreach ($k in $explicit.Keys) { $mapping[$k] = $explicit[$k] }
  $remaining = @($skillInputs | Where-Object { -not $mapping.Contains($_) })
  if ($positional.Count -gt 0) {
    if ($remaining.Count -eq 0) {
      foreach ($v in $positional) { $mapping[[System.IO.Path]::GetFileName($v)] = $v }
    } else {
      if ($positional.Count -gt $remaining.Count) {
        Fail ("입력 파일이 스킬이 요구하는 개수({0})보다 많습니다. '기대이름=파일' 형식으로 매핑하세요." -f $remaining.Count) `
             @{ skillInputs = $skillInputs }
      }
      for ($i = 0; $i -lt $positional.Count; $i++) { $mapping[$remaining[$i]] = $positional[$i] }
    }
  }
  if ($mapping.Count -eq 0) { Fail "입력 파일이 없습니다(-Inputs)." }
  foreach ($k in $mapping.Keys) {
    if (-not (Test-Path -LiteralPath $mapping[$k])) { Fail ("입력 파일을 찾을 수 없습니다: {0} (기대이름 {1})" -f $mapping[$k], $k) }
  }
  return $mapping
}

function Build-Groups($steps, $nameToExcel, $outputExcel) {
  $groups = New-Object System.Collections.ArrayList
  $cur = $null
  $i = 0
  foreach ($s in $steps) {
    $eid = $null
    if ($s.targetFileId -like "input:*") { $eid = $nameToExcel[$s.targetFileId.Substring(6)] }
    elseif ($s.targetFileId -like "output*") { $eid = $outputExcel }
    if (-not $eid) {
      if ($nameToExcel.Count -eq 1) { $eid = @($nameToExcel.Values)[0] }
      else { Fail ("단계 {0} 의 대상 파일({1})을 열린 세션과 연결하지 못했습니다." -f ($i+1), $s.targetFileId) }
    }
    $sp = [ordered]@{ code=$s.code; language=$s.language; targetSheetName=$s.targetSheetName; stepIdx=$i; stepId=$s.id }
    if ($cur -and $cur.excelId -eq $eid) { [void]$cur.steps.Add($sp) }
    else {
      $lst = New-Object System.Collections.ArrayList; [void]$lst.Add($sp)
      $cur = [pscustomobject]@{ excelId=$eid; steps=$lst }
      [void]$groups.Add($cur)
    }
    $i++
  }
  # ConvertTo-Json 을 위해 순수 객체로 변환
  # [단일요소 언랩 방지] 그룹이 1개면 PowerShell 이 배열을 언랩해 OrderedDictionary 로 반환하고,
  # 그러면 호출부의 $groups[0] 이 (배열 첫 원소가 아니라) 딕셔너리의 첫 '값'을 돌려줘 anchor 가
  # 깨진다(진행률 0/0). 앞에 콤마(,)를 붙여 배열을 통째로 반환한다.
  $built = @($groups | ForEach-Object { [ordered]@{ excelId=$_.excelId; steps=@($_.steps) } })
  return ,$built
}

# ── 메인 ────────────────────────────────────────────────────────────────────
$port = Discover-Port
$base = "http://127.0.0.1:$port"

# [주의] PowerShell 은 변수명 대소문자를 구분하지 않아 $skill 은 파라미터 $Skill(zip 경로)과 같은
# 변수다 — $skill 을 쓰면 스킬 객체가 경로 문자열로 덮여 파싱 결과가 사라진다(실측). $sk 로 분리한다.
$sk = @(Read-Skill $Skill)[0]
Log ("스킬: {0} | 단계 {1} | 기대 입력 {2}" -f $sk.name, $sk.steps.Count, ($sk.inputs -join ", "))

$inMap = Parse-Inputs $Inputs $sk.inputs
Log ("입력 매핑: " + (($inMap.Keys | ForEach-Object { "$_=" + [System.IO.Path]::GetFileName($inMap[$_]) }) -join ", "))

$opened = New-Object System.Collections.ArrayList   # 내가 연 excelId (끝에 닫기)
$nameToExcel = @{}
try {
  # 1) 입력 업로드(기대이름으로) + 세션 열기
  foreach ($expected in $inMap.Keys) {
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $inMap[$expected]).Path)
    $up = Api-Upload $base $expected $bytes
    if (-not $up.ok) { Fail ("업로드 실패: {0} ({1})" -f $expected, $up.error) }
    $op = Api-PostJson $base "/api/excel/open" @{ workbookId=$up.workbookId; liveEditable=$true; deferVisible=$true } 60
    if (-not $op.ok -or -not $op.excelId) { Fail ("세션 열기 실패: {0} ({1})" -f $expected, $op.error) }
    $nameToExcel[$expected] = $op.excelId
    [void]$opened.Add($op.excelId)
    Log ("열림: {0} -> {1}" -f $expected, $op.excelId)
  }

  # 2) 출력 템플릿(옵션)
  $outputExcel = $null
  if ($Output) {
    $outName = [System.IO.Path]::GetFileName($Output)
    $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Output).Path)
    $up = Api-Upload $base $outName $bytes
    if (-not $up.ok) { Fail ("출력 템플릿 업로드 실패: " + $up.error) }
    $op = Api-PostJson $base "/api/excel/open" @{ workbookId=$up.workbookId; liveEditable=$true; deferVisible=$true } 60
    if ($op.ok -and $op.excelId) { $outputExcel = $op.excelId; [void]$opened.Add($op.excelId); Log ("출력 열림: {0} -> {1}" -f $outName, $op.excelId) }
  }

  # 내가 연 세션 화면 억제(전역 hide 는 사용자 세션까지 숨기므로 개별 hide 만)
  foreach ($eid in $opened) { try { Api-PostJson $base "/api/excel/hide" @{ excelId=$eid; light=$true } 15 | Out-Null } catch {} }

  # 3) 실행 payload('스킬 기본값' = 시트 치환 없음, 파일명은 업로드 이름으로 이미 일치)
  $groups = Build-Groups $sk.steps $nameToExcel $outputExcel
  $resetIds = @($groups | ForEach-Object { $_.excelId } | Select-Object -Unique)

  if ($DryRun) {
    Emit-Result ([ordered]@{ ok=$true; dryRun=$true; port=$port; groups=$groups; resetExcelIds=$resetIds })
    return
  }

  # 4) 전체실행(파일 출력 모드). run-full-pipeline 은 1콜 블록 → 그 동안 진행률을 폴링해 stderr 로.
  $totalSteps = ($groups | ForEach-Object { $_.steps.Count } | Measure-Object -Sum).Sum
  $anchor = $groups[0].excelId
  Log ("전체실행 중... (단계 {0})" -f $totalSteps)

  # [ConvertTo-Json 단일요소 언랩 회피] PS 5.1 의 ConvertTo-Json 은 원소가 1개인 배열을 '배열이 아닌
  # 객체'로 직렬화한다 → 서버가 groups 를 dict 로 받아 그 키(문자열)를 순회, 'str has no get' 로 죽었다.
  # 배열 구조를 문자열로 직접 조립해 강제한다(문자열 이스케이프만 ConvertTo-Json 에 맡김 — 이건 안전).
  $J = { param($v) if ($null -eq $v) { "null" } else { ($v | ConvertTo-Json -Compress) } }
  $gj = foreach ($g in $groups) {
    $sj = foreach ($st in $g.steps) {
      '{"code":' + (& $J $st.code) + ',"language":' + (& $J $st.language) +
      ',"targetSheetName":' + (& $J $st.targetSheetName) +
      ',"stepIdx":' + [int]$st.stepIdx + ',"stepId":' + (& $J $st.stepId) + '}'
    }
    '{"excelId":' + (& $J $g.excelId) + ',"steps":[' + (($sj) -join ',') + ']}'
  }
  $rj = foreach ($r in $resetIds) { & $J $r }
  $runBody = '{"groups":[' + (($gj) -join ',') + '],"resetExcelIds":[' + (($rj) -join ',') + '],"viewSheet":null,"outputMode":"file"}'
  $job = Start-Job -ScriptBlock {
    param($uri, $body, $t)
    $b = [System.Text.Encoding]::UTF8.GetBytes($body)
    Invoke-RestMethod -Uri $uri -Method Post -Body $b -ContentType "application/json" -TimeoutSec $t
  } -ArgumentList "$base/api/excel/run-full-pipeline", $runBody, $Timeout

  # [폴링 간격] 작은 스킬은 몇 초 만에 끝나 진행률 비-0 구간이 짧다 → 800ms 간격 폴링(앵커가 맞으면 충분)(느린/큰 스킬에도 부담 없음). NotStarted 도 폴링(Start-Job 시동 레이스).
  $last = ""
  while ($job.State -ne "Completed" -and $job.State -ne "Failed" -and $job.State -ne "Stopped") {
    try {
      $p = Invoke-RestMethod -Uri "$base/api/excel/pipeline-progress?excelId=$anchor" -TimeoutSec 5
      if ($p.phase -eq "syncing") {
        $key = "sync:$($p.syncCurrent)/$($p.syncTotal)"
        if ($key -ne $last) { $last = $key; Log ("결과 반영 중... ({0}/{1})" -f $p.syncCurrent, $p.syncTotal); if ($ProgressJson) { Log ("PROGRESS " + (@{phase="syncing";current=$p.syncCurrent;total=$p.syncTotal} | ConvertTo-Json -Compress)) } }
      } elseif ($p.total -gt 0) {
        $key = "run:$($p.current)/$($p.total)"
        if ($key -ne $last) { $last = $key; $pct = [int]($p.current * 100 / $p.total); Log ("진행 {0}/{1} 단계 ({2}%)" -f $p.current, $p.total, $pct); if ($ProgressJson) { Log ("PROGRESS " + (@{phase="running";current=$p.current;total=$p.total;percent=$pct} | ConvertTo-Json -Compress)) } }
      }
    } catch {}
    Start-Sleep -Milliseconds 800
  }
  $res = $null
  try { $res = Receive-Job $job -ErrorAction Stop } catch { Remove-Job $job -Force -ErrorAction SilentlyContinue; Fail ("전체실행 요청 실패: " + $_.Exception.Message) }
  Remove-Job $job -Force -ErrorAction SilentlyContinue

  if (-not $res.ok) { Fail ("전체실행 실패: " + $res.error) @{ errorInfo = $res.errorInfo } }
  $outFiles = @($res.outputFiles)
  if ($outFiles.Count -eq 0) { Fail "전체실행은 됐지만 결과 파일이 없습니다(스킬이 파일을 바꾸지 않았을 수 있음)." @{ applied = $res.applied } }

  # 5) 결과 파일 내려받아 zip 으로 묶기
  $outDir = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($OutZip))
  if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  if (Test-Path -LiteralPath $OutZip) { Remove-Item -LiteralPath $OutZip -Force }
  $za = [System.IO.Compression.ZipFile]::Open([System.IO.Path]::GetFullPath($OutZip), "Create")
  $packed = New-Object System.Collections.ArrayList
  try {
    $n = 0
    foreach ($of in $outFiles) {
      $dl = if ($of.downloadUrl) { [string]$of.downloadUrl } else { "/api/workbooks/download/" + $of.downloadId }
      $blob = Api-GetBytes $base $dl
      $arc = if ($of.name) { [string]$of.name } else { "결과_$n.xlsx" }
      $e = $za.CreateEntry($arc)
      $st = $e.Open()
      try { $st.Write($blob, 0, $blob.Length) } finally { $st.Dispose() }
      [void]$packed.Add($arc); $n++
    }
  } finally { $za.Dispose() }
  Log ("결과 zip: {0} | 파일 {1}" -f $OutZip, ($packed -join ", "))

  Emit-Result ([ordered]@{ ok=$true; port=$port; outZip=[System.IO.Path]::GetFullPath($OutZip);
                           files=@($packed); applied=$res.applied; skill=$sk.name })
}
catch {
  Fail ("예기치 못한 오류: " + $_.Exception.Message)
}
finally {
  if (-not $KeepOpen) {
    foreach ($eid in $opened) { try { Api-PostJson $base "/api/excel/close" @{ excelId=$eid } 30 | Out-Null } catch {} }
  }
}

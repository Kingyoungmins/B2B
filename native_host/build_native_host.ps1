$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BinDir = Join-Path $ScriptDir "bin"
$PkgRoot = Join-Path $ScriptDir "packages"
$PkgVersion = "1.0.2903.40"
$PkgName = "Microsoft.Web.WebView2"
$PkgDir = Join-Path $PkgRoot "$PkgName.$PkgVersion"
$Nupkg = Join-Path $PkgRoot "$PkgName.$PkgVersion.nupkg"
$OfflineNupkg = Join-Path $RootDir "tools\offline\nuget\$PkgName.$PkgVersion.nupkg"

New-Item -ItemType Directory -Force -Path $BinDir, $PkgRoot | Out-Null

if (!(Test-Path $PkgDir)) {
  if (Test-Path $OfflineNupkg) {
    Write-Host "Using offline WebView2 package: $OfflineNupkg"
    Copy-Item -Force $OfflineNupkg $Nupkg
  } elseif ($env:B2B_OFFLINE_BUILD -eq "1") {
    throw "Offline WebView2 package not found: $OfflineNupkg"
  } else {
    $url = "https://www.nuget.org/api/v2/package/$PkgName/$PkgVersion"
    Write-Host "Downloading $PkgName $PkgVersion..."
    Invoke-WebRequest -Uri $url -OutFile $Nupkg
  }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($Nupkg, $PkgDir)
}

$libDir = Join-Path $PkgDir "lib\net462"
if (!(Test-Path $libDir)) {
  $libDir = Get-ChildItem -Path (Join-Path $PkgDir "lib") -Directory |
    Where-Object { $_.Name -match "^net" } |
    Sort-Object Name -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (!(Test-Path $libDir)) {
  throw "WebView2 lib directory not found in $PkgDir"
}

$coreDll = Join-Path $libDir "Microsoft.Web.WebView2.Core.dll"
$winFormsDll = Join-Path $libDir "Microsoft.Web.WebView2.WinForms.dll"
$loaderDll = Join-Path $PkgDir "runtimes\win-x64\native\WebView2Loader.dll"
if (!(Test-Path $coreDll)) { throw "Missing $coreDll" }
if (!(Test-Path $winFormsDll)) { throw "Missing $winFormsDll" }
if (!(Test-Path $loaderDll)) { throw "Missing $loaderDll" }

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $csc)) {
  throw "C# compiler not found: $csc"
}

$outExe = Join-Path $BinDir "B2B_NativeHost.exe"
$src = Join-Path $ScriptDir "NativeHost.cs"

# [version resource] generate assembly attributes (version read from launch_b2b.py only).
# If generation fails the build continues; only the file properties stay empty.
$repoRoot = Split-Path $ScriptDir -Parent
$asmInfo = Join-Path $repoRoot "build_meta\AssemblyInfo_host.cs"
try {
  & python (Join-Path $repoRoot "tools\gen_version_meta.py") | Out-Host
} catch {
  Write-Host "[warn] version metadata generation skipped: $_"
}
$asmArg = @()
if (Test-Path $asmInfo) { $asmArg = @($asmInfo) } else { Write-Host "[warn] $asmInfo not found - version info will be empty" }

# [앱 아이콘 2026-08-20] 아이콘이미지.png 에서 생성한 assets\axcell.ico — 없으면 기본 아이콘으로 진행.
$icoPath = Join-Path $repoRoot "assets\axcell.ico"
$icoArg = @()
if (Test-Path $icoPath) { $icoArg = @("/win32icon:$icoPath") } else { Write-Host "[warn] $icoPath not found - default exe icon" }

Write-Host "Compiling native host..."
& $csc /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 `
  /reference:System.dll `
  /reference:System.Core.dll `
  /reference:System.Drawing.dll `
  /reference:System.Windows.Forms.dll `
  /reference:"$coreDll" `
  /reference:"$winFormsDll" `
  /out:"$outExe" `
  @icoArg `
  "$src" @asmArg
if ($LASTEXITCODE -ne 0) {
  throw "Native host compile failed with exit code $LASTEXITCODE"
}

Copy-Item -Force $coreDll $BinDir
Copy-Item -Force $winFormsDll $BinDir
Copy-Item -Force $loaderDll $BinDir

Write-Host "Built $outExe"

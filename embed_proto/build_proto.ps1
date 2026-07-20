$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BinDir = Join-Path $ScriptDir "bin"
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $csc)) {
  throw "C# compiler not found: $csc"
}

$outExe = Join-Path $BinDir "ExcelEmbedProto.exe"
$src = Join-Path $ScriptDir "ExcelEmbedProto.cs"

Write-Host "Compiling Excel embed prototype..."
& $csc /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 `
  /reference:System.dll `
  /reference:System.Core.dll `
  /reference:System.Drawing.dll `
  /reference:System.Windows.Forms.dll `
  /out:"$outExe" `
  "$src"
if ($LASTEXITCODE -ne 0) {
  throw "Prototype compile failed with exit code $LASTEXITCODE"
}

Write-Host "Built $outExe"

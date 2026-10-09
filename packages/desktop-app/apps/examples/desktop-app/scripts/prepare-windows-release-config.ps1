$ErrorActionPreference = "Stop"

$tauriRoot = Join-Path $PSScriptRoot "..\src-tauri"
$windowsConfigPath = Join-Path $tauriRoot "tauri.windows.conf.json"
$config = Get-Content -Raw $windowsConfigPath | ConvertFrom-Json -AsHashtable

$config.bundle.createUpdaterArtifacts = $true
$config.bundle.windows.signCommand = @{
  cmd = "powershell"
  args = @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Join-Path $PSScriptRoot "tauri-sign-windows.ps1"),
    "%1"
  )
}

$outputPath = Join-Path $tauriRoot "tauri.windows.ci.conf.json"
$config | ConvertTo-Json -Depth 20 | Set-Content -Path $outputPath -Encoding utf8NoBOM
Write-Host "Prepared Windows signing config at $outputPath"

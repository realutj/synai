# SynAI Installation Script for Windows
# https://github.com/realutj/synai

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

Write-Host "[>] Installing SynAI..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "[X] Node.js is not installed." -ForegroundColor Red
    Write-Host "Please install Node.js (v18 or higher) from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check Node.js version
$nodeMajorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($nodeMajorVersion -lt 22) {
    Write-Host "[!] Node.js version $nodeVersion detected." -ForegroundColor Yellow
    Write-Host "    SynAI works best with Node.js v22 or higher." -ForegroundColor Yellow
    Write-Host "    Continuing with current version..." -ForegroundColor Yellow
    Write-Host ""
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "[OK] npm $npmVersion detected" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[X] npm is not installed." -ForegroundColor Red
    Write-Host "Please install npm." -ForegroundColor Yellow
    exit 1
}

# Install via npm
Write-Host "[*] Installing synai from npm..." -ForegroundColor Cyan
try {
    npm install -g synai
    Write-Host ""
    Write-Host "[OK] SynAI installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[+] You can now run: synai" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "[Docs] Documentation: https://github.com/realutj/synai" -ForegroundColor Cyan
    Write-Host "[Help] Issues: https://github.com/realutj/synai/issues" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "[X] Installation failed." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "[Tip] Try running PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}

#Requires -Version 5.1
<#
  Push to GitHub from China: try direct, then common local proxy ports (Clash / V2Ray).
  Run from repo root:
    .\scripts\git-push-cn.ps1
    .\scripts\git-push-cn.ps1 -Proxy "http://127.0.0.1:7897"
#>
param(
  [string]$Branch = "main",
  [string]$Remote = "origin",
  [string]$Proxy = ""
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not (Test-Path (Join-Path $Root ".git"))) {
  Write-Host "ERROR: .git not found at repo root: $Root" -ForegroundColor Red
  exit 1
}
Set-Location -LiteralPath $Root

function Test-TcpOpen {
  param([string]$TargetHost, [int]$TargetPort, [int]$TimeoutMs = 800)
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect($TargetHost, $TargetPort, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { $c.Close(); return $false }
    $c.EndConnect($iar)
    $c.Close()
    return $true
  } catch { return $false }
}

function Git-PushWithProxy {
  param([string]$ProxyUrl)
  if ($ProxyUrl) {
    Write-Host "==> Using proxy: $ProxyUrl" -ForegroundColor Cyan
    $env:HTTP_PROXY = $ProxyUrl
    $env:HTTPS_PROXY = $ProxyUrl
    $env:ALL_PROXY = $ProxyUrl
    git -c "http.proxy=$ProxyUrl" -c "https.proxy=$ProxyUrl" push -u $Remote $Branch
  } else {
    Write-Host "==> Direct push (no proxy)..." -ForegroundColor Cyan
    Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
    Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
    Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue
    git push -u $Remote $Branch
  }
  if ($LASTEXITCODE -ne 0) {
    throw "git push exit code $LASTEXITCODE"
  }
}

Write-Host "Repo: $Root" -ForegroundColor Gray

if ($Proxy) {
  try {
    Git-PushWithProxy -ProxyUrl $Proxy
    Write-Host "Push OK." -ForegroundColor Green
    exit 0
  } catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
  }
}

try {
  Git-PushWithProxy -ProxyUrl ""
  Write-Host "Push OK (direct)." -ForegroundColor Green
  exit 0
} catch {
  Write-Host "Direct failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

$candidates = @(
  "http://127.0.0.1:7890",
  "http://127.0.0.1:7897",
  "http://127.0.0.1:10809",
  "http://127.0.0.1:8080"
)

foreach ($p in $candidates) {
  if ($p -match "127\.0\.0\.1:(\d+)") {
    $port = [int]$Matches[1]
    if (-not (Test-TcpOpen -TargetHost "127.0.0.1" -TargetPort $port)) { continue }
  }
  Write-Host "Try $p ..." -ForegroundColor Yellow
  try {
    Git-PushWithProxy -ProxyUrl $p
    Write-Host "Push OK via $p" -ForegroundColor Green
    exit 0
  } catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

$socks = @("socks5h://127.0.0.1:7891", "socks5h://127.0.0.1:7890")
foreach ($p in $socks) {
  if ($p -match "127\.0\.0\.1:(\d+)") {
    $port = [int]$Matches[1]
    if (-not (Test-TcpOpen -TargetHost "127.0.0.1" -TargetPort $port)) { continue }
  }
  Write-Host "Try $p ..." -ForegroundColor Yellow
  try {
    Git-PushWithProxy -ProxyUrl $p
    Write-Host "Push OK via $p" -ForegroundColor Green
    exit 0
  } catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

$help = @"

Still failed. Options:
  1) Turn on Clash/V2 system proxy, then:
     .\scripts\git-push-cn.ps1 -Proxy "http://127.0.0.1:YOUR_PORT"
  2) Git global (example port 7890):
     git config --global http.https://github.com.proxy http://127.0.0.1:7890
     git config --global https.https://github.com.proxy http://127.0.0.1:7890
  3) One-shot:
     `$env:HTTPS_PROXY="http://127.0.0.1:7890"; git push -u origin main

Note: public GitHub mirrors usually cannot authenticate push; you need a local proxy or VPN.

"@
Write-Host $help -ForegroundColor Red
exit 1

# ==============================================================================
# SwiftCOD - Cloudflare Local Production Tunnel Runner
# Points permanent/persistent Cloudflare edge gateway to local Remix dev server
# ==============================================================================

param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SwiftCOD: Launching Cloudflare Production Tunnel        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify cloudflared existence
$cloudflaredCmd = Get-Command "cloudflared" -ErrorAction SilentlyContinue
if (-not $cloudflaredCmd) {
    Write-Host "[ERROR] cloudflared is not found in PATH." -ForegroundColor Red
    Write-Host "To install, run: winget install --id Cloudflare.cloudflared" -ForegroundColor Yellow
    exit 1
}

Write-Host "[✔] cloudflared found at: $($cloudflaredCmd.Source)" -ForegroundColor Green
Write-Host "[*] Forwarding traffic to: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "[*] Initiating tunnel connection..." -ForegroundColor Yellow

# 2. Run cloudflared and capture output
$logFile = "$PSScriptRoot\cloudflared.log"
if (Test-Path $logFile) { Remove-Item $logFile -Force }

$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "cloudflared"
$processInfo.Arguments = "tunnel --url http://localhost:$Port"
$processInfo.RedirectStandardError = $true
$processInfo.RedirectStandardOutput = $true
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo
$process.Start() | Out-Null

$tunnelUrl = $null
$timeoutSeconds = 30
$elapsed = 0

while ($elapsed -lt $timeoutSeconds) {
    Start-Sleep -Seconds 1
    $elapsed++
    
    $errLine = $process.StandardError.ReadLine()
    if ($errLine) {
        Add-Content -Path $logFile -Value $errLine
        if ($errLine -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
            $tunnelUrl = $matches[0]
            break
        }
    }
}

if ($tunnelUrl) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  CLOUDFLARE TUNNEL ONLINE!                               " -ForegroundColor Green
    Write-Host "  Gateway URL: $tunnelUrl" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Green
    
    # 3. Update shopify.app.toml
    $tomlPath = Join-Path $PSScriptRoot "..\shopify.app.toml"
    if (Test-Path $tomlPath) {
        $tomlContent = Get-Content $tomlPath -Raw
        $tomlContent = $tomlContent -replace 'application_url\s*=\s*"[^"]*"', "application_url = `"$tunnelUrl`""
        $tomlContent = $tomlContent -replace 'redirect_urls\s*=\s*\[\s*"[^"]*"\s*\]', "redirect_urls = [ `"$tunnelUrl/api/auth`" ]"
        Set-Content -Path $tomlPath -Value $tomlContent -NoNewline
        Write-Host "[✔] shopify.app.toml updated with $tunnelUrl" -ForegroundColor Green
    }
    
    # 4. Save metadata
    $meta = @{
        tunnelUrl = $tunnelUrl
        port = $Port
        timestamp = (Get-Date).ToString("o")
        metaWebhookUrl = "$tunnelUrl/api/whatsapp/webhook"
    } | ConvertTo-Json
    Set-Content -Path "$PSScriptRoot\tunnel-info.json" -Value $meta
    
    Write-Host "[✔] WhatsApp Webhook URL: $tunnelUrl/api/whatsapp/webhook" -ForegroundColor Cyan
} else {
    Write-Host "[!] Could not extract tunnel URL within timeout. Check log at: $logFile" -ForegroundColor Yellow
}

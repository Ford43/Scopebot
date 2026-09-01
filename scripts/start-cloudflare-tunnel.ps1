# รัน Cloudflare Tunnel บน Windows host (ชี้ไป localhost:80)
# ใช้เมื่อไม่อยากใส่ cloudflared ใน Docker
#
# Named tunnel:
#   $env:CLOUDFLARE_TUNNEL_TOKEN = "...."
#   .\scripts\start-cloudflare-tunnel.ps1
#
# Quick tunnel (ไม่มี token):
#   .\scripts\start-cloudflare-tunnel.ps1 -Quick

param(
    [switch]$Quick
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "ยังไม่มี cloudflared — ติดตั้งด้วย:" -ForegroundColor Yellow
    Write-Host "  winget install Cloudflare.cloudflared"
    Write-Host "หรือดาวน์โหลดจาก https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
}

if ($Quick) {
    Write-Host "Starting quick tunnel -> http://localhost:80" -ForegroundColor Cyan
    Write-Host "คัดลอก https://....trycloudflare.com จาก output แล้วใส่ FRONTEND_URL + CORS_ORIGINS" -ForegroundColor Cyan
    cloudflared tunnel --url http://localhost:80
    exit $LASTEXITCODE
}

$token = $env:CLOUDFLARE_TUNNEL_TOKEN
if (-not $token) {
    Write-Host "ตั้ง CLOUDFLARE_TUNNEL_TOKEN ก่อน หรือใช้ -Quick" -ForegroundColor Red
    exit 1
}

Write-Host "Starting named tunnel (token) -> ตรวจว่า Cloudflare Public Hostname ชี้ http://localhost:80" -ForegroundColor Cyan
cloudflared tunnel --no-autoupdate run --token $token

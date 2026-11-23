# ReysPro: Super Admin botini ulash (23.11.2026). Administrator PowerShell'da ishga tushiring:
#   powershell -ExecutionPolicy Bypass -File C:\logistika\scripts\admin-bot-sozlash.ps1
#
# Avval Telegram'da @BotFather -> /newbot -> nom (masalan "ReysPro Admin") va username (masalan reyspro_admin_bot).
# BotFather bergan tokenni shu skript so'raydi (yashirin kiritiladi, faqat C:\logistika\.env ga yoziladi).
# Bu bot haydovchilar botidan ALOHIDA bo'lishi kerak.
$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "Bu skriptni Administrator sifatida ishga tushiring." -ForegroundColor Red; exit 1 }

$EnvFile = 'C:\logistika\.env'
$Utf8 = New-Object System.Text.UTF8Encoding $false
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Read-Secret([string]$prompt) {
  $s = Read-Host -Prompt $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Get-EnvVar([string]$name) {
  if (-not (Test-Path $EnvFile)) { return '' }
  foreach ($l in [IO.File]::ReadAllLines($EnvFile, $Utf8)) {
    if ($l -match "^\s*$([regex]::Escape($name))\s*=\s*`"?([^`"]*)`"?\s*$") { return $Matches[1].Trim() }
  }
  return ''
}

function Set-EnvVar([string]$name, [string]$value) {
  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path $EnvFile) { foreach ($l in [IO.File]::ReadAllLines($EnvFile, $Utf8)) { $lines.Add($l) } }
  $escaped = $value.Replace('\', '\\').Replace('"', '\"').Replace('$', '\$')
  $line = "$name=`"$escaped`""
  $idx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^\s*$([regex]::Escape($name))\s*=") { $idx = $i; break } }
  if ($idx -ge 0) { $lines[$idx] = $line } else { $lines.Add($line) }
  [IO.File]::WriteAllLines($EnvFile, $lines, $Utf8)
}

Write-Host ""
Write-Host "=== ReysPro: Super Admin boti ===" -ForegroundColor Cyan
$token = Read-Secret "Yangi botning tokeni (@BotFather bergan, ekranda ko'rinmaydi)"
if (-not $token) { Write-Host "Bekor qilindi."; Read-Host "Enter"; exit 0 }

if ($token -eq (Get-EnvVar 'TELEGRAM_BOT_TOKEN')) {
  Write-Host "XATO: bu haydovchilar botining tokeni. Super Admin uchun @BotFather'da ALOHIDA yangi bot oching." -ForegroundColor Red
  Read-Host "Enter"
  exit 1
}

try {
  $me = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/getMe" -TimeoutSec 20
  if (-not $me.ok) { throw "javob muvaffaqiyatsiz" }
  Write-Host "OK: bot topildi - @$($me.result.username)" -ForegroundColor Green
} catch {
  Write-Host "XATO: token noto'g'ri - $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Saqlanmadi."
  Read-Host "Enter"
  exit 1
}

Set-EnvVar 'SUPERADMIN_BOT_TOKEN' $token
$token = $null
Write-Host "Saqlandi (.env)." -ForegroundColor Green

Write-Host "Server qayta ishga tushirilmoqda..."
Stop-ScheduledTask -TaskName 'Logistika Server' -ErrorAction SilentlyContinue
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName 'Logistika Server'
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try { if ((Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { Write-Host "Tayyor: server ishlayapti." -ForegroundColor Green; break } } catch {}
}
Write-Host ""
Write-Host "Endi Telegram'da @$($me.result.username) ni oching, /start bosing va 'Telefon raqamni yuborish' tugmasini bosing." -ForegroundColor Yellow
Write-Host "Raqamingiz ReysPro'dagi Super Admin raqami bilan bir xil bo'lishi kerak."
Read-Host "Enter"

# ReysPro: Telegram botda ovozli kiritishni yoqish (21.11.2026).
# Administrator PowerShell'da ishga tushiring:
#   powershell -ExecutionPolicy Bypass -File C:\logistika\scripts\ovoz-sozlash.ps1
#
# Kerak: Cloudflare hisobi (reyspro.uz domeni ulangan o'sha hisob).
#   Cloudflare -> AI -> Workers AI -> "Use REST API":
#     - Account ID (ochiq ko'rinadi);
#     - "Create a Workers AI API Token" -> token (yashirin kiritiladi, faqat C:\logistika\.env ga yoziladi).
# Skript tokenni tekshiradi, xohlasangiz ovozli fayl (ogg/mp3/m4a/wav) matnga qanday o'girilishini ko'rsatadi,
# so'ng serverni qayta ishga tushiradi.
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

function Invoke-Ai([string]$account, [string]$token, [string]$model, $body) {
  $json = $body | ConvertTo-Json -Depth 6 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $uri = "https://api.cloudflare.com/client/v4/accounts/$account/ai/run/$model"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec 120
}

Write-Host ""
Write-Host "=== ReysPro: ovozli kiritish (Cloudflare Workers AI) ===" -ForegroundColor Cyan
$account = (Read-Host -Prompt "Account ID").Trim()
if (-not $account) { Write-Host "Bekor qilindi."; Read-Host "Enter"; exit 0 }
$token = Read-Secret "Workers AI token (ekranda ko'rinmaydi)"
if (-not $token) { Write-Host "Bekor qilindi."; Read-Host "Enter"; exit 0 }

try {
  $r = Invoke-Ai $account $token '@cf/meta/llama-3.3-70b-instruct-fp8-fast' @{ messages = @(@{ role = 'user'; content = 'Faqat OK deb javob ber.' }); max_tokens = 5 }
  if (-not $r.success) { throw "javob muvaffaqiyatsiz" }
  Write-Host "OK: token ishlayapti." -ForegroundColor Green
} catch {
  Write-Host "XATO: Account ID yoki token noto'g'ri (yoki Workers AI huquqi yo'q) - $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Saqlanmadi."
  Read-Host "Enter"
  exit 1
}

Write-Host ""
Write-Host "Ovoz sifatini sinash: Telegram'dan ovozli xabarni faylga saqlab (yoki telefonda yozib), yo'lini kiriting."
Write-Host "Masalan: C:\Users\Komiljon\Downloads\audio.ogg   (Enter - o'tkazib yuborish)"
$file = (Read-Host -Prompt "Fayl").Trim().Trim('"')
if ($file) {
  if (-not (Test-Path $file)) {
    Write-Host "Fayl topilmadi: $file" -ForegroundColor Red
  } else {
    try {
      $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file))
      $auto = Invoke-Ai $account $token '@cf/openai/whisper-large-v3-turbo' @{ audio = $b64; vad_filter = $true }
      Write-Host ""
      Write-Host "Til o'zi aniqlandi: $($auto.result.transcription_info.language)" -ForegroundColor Yellow
      Write-Host $auto.result.text
      $uzb = Invoke-Ai $account $token '@cf/openai/whisper-large-v3-turbo' @{ audio = $b64; vad_filter = $true; language = 'uz' }
      Write-Host ""
      Write-Host "O'zbek tili majburan:" -ForegroundColor Yellow
      Write-Host $uzb.result.text
      Write-Host ""
    } catch {
      Write-Host "XATO: ovoz matnga o'girilmadi - $($_.Exception.Message)" -ForegroundColor Red
    }
  }
}

Set-EnvVar 'CF_ACCOUNT_ID' $account
Set-EnvVar 'CF_AI_TOKEN' $token
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
  try { if ((Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { Write-Host "Tayyor: server ishlayapti. Botga ovozli xabar yuborib ko'ring." -ForegroundColor Green; break } } catch {}
}
Write-Host ""
Read-Host "Enter"

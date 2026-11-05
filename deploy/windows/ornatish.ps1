#Requires -RunAsAdministrator
# Noutbukni Logistika sinov serveriga aylantiradi. Qayta ishga tushirsa ham xavfsiz.
# Ishga tushirish (Administrator PowerShell):
#   powershell -ExecutionPolicy Bypass -File C:\Logistika\deploy\windows\ornatish.ps1
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "umumiy.ps1")
Set-Location $Root

function Install-Pkg([string]$Id, [string[]]$Extra = @()) {
  winget list -e --id $Id --accept-source-agreements | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "$Id allaqachon o'rnatilgan"; return }
  $wa = @("install", "-e", "--id", $Id, "--accept-package-agreements", "--accept-source-agreements") + $Extra
  if ($Extra.Count -eq 0) { $wa += "--silent" }
  & winget @wa
  if ($LASTEXITCODE -ne 0) { throw "$Id o'rnatilmadi (winget kod $LASTEXITCODE)" }
  Ok "$Id o'rnatildi"
}

function New-Secret([int]$Bytes) {
  $b = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  ([Convert]::ToBase64String($b)) -replace '[+/=]', ''
}

Step "1/7 Kompyuter uxlab qolmasligi uchun quvvat sozlamalari"
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0   # qopqoq yopilsa ham ishlayveradi
powercfg /setactive SCHEME_CURRENT
Ok "Zaryadga ulangan paytda uxlamaydi, qopqoq yopilsa ham ishlaydi"

Step "2/7 Dasturlarni o'rnatish: Node.js, Tailscale, PostgreSQL"
Install-Pkg "OpenJS.NodeJS.LTS"
Install-Pkg "Tailscale.Tailscale"
$superPwFile = Join-Path $Root "postgres-parol.txt"
if (Test-Path (Join-Path $PgBin "psql.exe")) {
  Ok "PostgreSQL $PgVersion allaqachon o'rnatilgan"
  if (Test-Path $superPwFile) { $superPw = (Get-Content $superPwFile -Raw).Trim() }
  else { $superPw = Read-Host "PostgreSQL o'rnatilganda qo'yilgan 'postgres' parolini kiriting" }
} else {
  $superPw = New-Secret 24
  [IO.File]::WriteAllText($superPwFile, $superPw)
  Install-Pkg "PostgreSQL.PostgreSQL.$PgVersion" @("--override",
    "--mode unattended --unattendedmodeui none --superpassword $superPw --serverport 5432")
}
Refresh-Path

Step "3/7 Ma'lumotlar bazasi va .env fayli"
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
  Ok ".env allaqachon bor, tegmaymiz"
} else {
  $appPw = New-Secret 24
  $env:PGPASSWORD = $superPw
  $psql = Join-Path $PgBin "psql.exe"
  $hasRole = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_roles WHERE rolname='logistika'"
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL ga ulanib bo'lmadi (parol noto'g'ri yoki xizmat ishlamayapti)" }
  if ($hasRole -match '1') { Invoke-Checked $psql @("-U", "postgres", "-h", "localhost", "-c", "ALTER ROLE logistika WITH LOGIN PASSWORD '$appPw'") }
  else { Invoke-Checked $psql @("-U", "postgres", "-h", "localhost", "-c", "CREATE ROLE logistika LOGIN PASSWORD '$appPw'") }
  $hasDb = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='logistika'"
  if ($hasDb -notmatch '1') { Invoke-Checked $psql @("-U", "postgres", "-h", "localhost", "-c", "CREATE DATABASE logistika OWNER logistika") }
  Remove-Item Env:PGPASSWORD
  $content = "DATABASE_URL=`"postgresql://logistika:$appPw@localhost:5432/logistika`"`r`n" +
             "SESSION_SECRET=`"$(New-Secret 48)`"`r`n"
  [IO.File]::WriteAllText($envFile, $content)   # BOM siz UTF-8
  Ok "Baza 'logistika' tayyor, .env yozildi"
}

Step "4/7 Dasturni yig'ish (bir necha daqiqa)"
Stop-App
Invoke-Checked "npm.cmd" @("ci")
Invoke-Checked "npx.cmd" @("prisma", "db", "push", "--skip-generate")
Invoke-Checked "npm.cmd" @("run", "build")

Step "5/7 Super Admin foydalanuvchisi"
$phone = Read-Host "Super Admin telefon raqami (masalan +998901234567)"
$sec = Read-Host "Super Admin paroli (kamida 8 belgi)" -AsSecureString
$env:SEED_ADMIN_PHONE = $phone
$env:SEED_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
Invoke-Checked "npm.cmd" @("run", "db:seed")
Remove-Item Env:SEED_ADMIN_PASSWORD

Step "6/7 Kompyuter yonganda dastur o'zi ishga tushadigan qilish"
$ps = "powershell.exe"
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$appSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $TaskApp -Force -Principal $principal -Settings $appSettings `
  -Trigger (New-ScheduledTaskTrigger -AtStartup) `
  -Action (New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\ishga-tushir.ps1`"") | Out-Null
$bkSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName $TaskBackup -Force -Principal $principal -Settings $bkSettings `
  -Trigger (New-ScheduledTaskTrigger -Daily -At "03:00") `
  -Action (New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\zaxira.ps1`"") | Out-Null
Start-ScheduledTask -TaskName $TaskApp
Ok "Dastur ishga tushdi: http://localhost:$Port"
Ok "Har kuni 03:00 da zaxira nusxa: $BackupDir"

Step "7/7 Tayyor"
Write-Host "Endi internetga chiqarish uchun: powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\internet.ps1`""

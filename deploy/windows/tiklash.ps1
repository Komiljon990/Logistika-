#Requires -RunAsAdministrator
# Zaxira nusxadan bazani tiklaydi. DIQQAT: hozirgi ma'lumotlar zaxiradagisi bilan almashtiriladi.
#   powershell -ExecutionPolicy Bypass -File tiklash.ps1 C:\Logistika-zaxira\logistika-2026-11-05_0300.dump
param([Parameter(Mandatory = $true)][string]$DumpFile)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "umumiy.ps1")
if (-not (Test-Path $DumpFile)) { throw "Fayl topilmadi: $DumpFile" }
$answer = Read-Host "Hozirgi ma'lumotlar o'chib, zaxiradagisi qo'yiladi. Davom etamizmi? (ha/yo'q)"
if ($answer -ne "ha") { Write-Host "Bekor qilindi."; exit 1 }

Step "Hozirgi holatni ham zaxiralab qo'yamiz (ehtiyot uchun)"
& (Join-Path $PSScriptRoot "zaxira.ps1")
$db = Read-DatabaseUrl
Stop-App
$env:PGPASSWORD = $db.Password
Invoke-Checked (Join-Path $PgBin "pg_restore.exe") @("-U", $db.User, "-h", $db.Host, "-p", $db.Port, "-d", $db.Db, "--clean", "--if-exists", "--no-owner", $DumpFile)
Remove-Item Env:PGPASSWORD
Start-ScheduledTask -TaskName $TaskApp
Ok "Tiklandi va dastur qayta ishga tushdi"

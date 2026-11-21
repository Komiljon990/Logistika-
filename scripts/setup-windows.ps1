# Bir martalik sozlash. Administrator PowerShell'da ishga tushiring:
#   powershell -ExecutionPolicy Bypass -File C:\logistika\scripts\setup-windows.ps1
# 1) Firewall: 3000-port faqat Private tarmoq uchun ochiladi
# 2) "Logistika Server" vazifasi: kompyuter yonganda server avtomatik ishga tushadi (SYSTEM nomidan)
# 3) "Logistika Backup" vazifasi: har kuni 02:00 da baza zaxira nusxasi D:\logistika-data\backups ga
$ErrorActionPreference = 'Stop'

Get-NetFirewallRule -DisplayName 'Logistika (TCP 3000)' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Logistika (TCP 3000)' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private | Out-Null
Write-Output "Firewall qoidasi qo'shildi."

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

$a1 = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\logistika\scripts\start-server.ps1'
$t1 = New-ScheduledTaskTrigger -AtStartup
$s1 = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'Logistika Server' -Action $a1 -Trigger $t1 -Principal $principal -Settings $s1 -Force | Out-Null

$a2 = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File C:\logistika\scripts\backup.ps1'
$t2 = New-ScheduledTaskTrigger -Daily -At 2am
$s2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName 'Logistika Backup' -Action $a2 -Trigger $t2 -Principal $principal -Settings $s2 -Force | Out-Null

Write-Output "Vazifalar yaratildi. Serverni hozir ishga tushirish: Start-ScheduledTask 'Logistika Server'"
Get-ScheduledTask -TaskName 'Logistika*' | Format-Table TaskName, State

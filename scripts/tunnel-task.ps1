# Cloudflare Tunnel'ni rejalashtirilgan vazifa sifatida o'rnatish (Administrator, 18.11.2026).
# Windows xizmati (cloudflared service) bu kompyuterda ishga tushmadi, shuning uchun "Logistika Server" kabi
# SYSTEM nomidan, kompyuter yoqilganda ishlaydigan vazifa. Sozlama va kalit: C:\ProgramData\cloudflared.
param([string]$TunnelId = '1e1e130a-0874-4d24-91c4-e9c867c4ccb0')
$ErrorActionPreference = 'Stop'
$cf = "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe"
$data = 'C:\ProgramData\cloudflared'
$log = 'D:\logistika-data\logs\tunnel-start.log'
"=== $(Get-Date) (task)" | Out-File $log -Encoding utf8

# Ishlamagan xizmatni olib tashlaymiz.
if (Get-Service cloudflared -ErrorAction SilentlyContinue) {
  Stop-Service cloudflared -ErrorAction SilentlyContinue
  # cmd orqali: PowerShell 5.1 dasturning stderr chiqishini xato deb skriptni to'xtatmasligi uchun.
  cmd.exe /c "`"$cf`" service uninstall >nul 2>&1"
  Start-Sleep -Seconds 2
}

New-Item -ItemType Directory -Force $data | Out-Null
if (-not (Test-Path "$data\$TunnelId.json")) { Copy-Item "C:\Users\komil\.cloudflared\$TunnelId.json" "$data\$TunnelId.json" -Force }
$cfg = @"
tunnel: $TunnelId
credentials-file: $data\$TunnelId.json
logfile: D:\logistika-data\logs\cloudflared.log
ingress:
  - hostname: crm.reyspro.uz
    service: http://localhost:3000
  - hostname: reyspro.uz
    service: http://localhost:3000
  - hostname: www.reyspro.uz
    service: http://localhost:3000
  - service: http_status:404
"@
[IO.File]::WriteAllText("$data\config.yml", $cfg, (New-Object Text.UTF8Encoding $false))
icacls $data /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null

$action = New-ScheduledTaskAction -Execute $cf -Argument "tunnel --config `"$data\config.yml`" run"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'Logistika Tunnel' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'Logistika Tunnel'
Start-Sleep -Seconds 10
"task: $((Get-ScheduledTask -TaskName 'Logistika Tunnel').State)" | Out-File $log -Append -Encoding utf8

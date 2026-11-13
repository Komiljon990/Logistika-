# Logistika sinov serverini ishga tushiradi (production build, lokal tarmoq uchun 0.0.0.0:3000).
# Loglar: D:\logistika-data\logs
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:NEXT_TELEMETRY_DISABLED = '1'
$logDir = 'D:\logistika-data\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("server-{0:yyyy-MM-dd}.log" -f (Get-Date))

Set-Location 'C:\logistika'
# cmd orqali: PowerShell 5.1 node'ning stderr chiqishini xato deb skriptni to'xtatmasligi uchun.
$ErrorActionPreference = 'Continue'
cmd.exe /c "node node_modules\next\dist\bin\next start -H 0.0.0.0 -p 3000 >> `"$log`" 2>&1"
exit $LASTEXITCODE

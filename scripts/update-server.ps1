# Yangi versiyani ishga tushirish (kod o'zgargandan keyin). Administrator PowerShell'da:
#   powershell -ExecutionPolicy Bypass -File C:\logistika\scripts\update-server.ps1
# 1) "Logistika Server" vazifasi to'xtatiladi (3000-port bo'shaydi, Prisma fayllari qulfdan chiqadi)
# 2) Loyiha qayta yig'iladi (prisma generate + next build)
# 3) Vazifa qayta ishga tushiriladi va sayt javob berishi tekshiriladi
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:NEXT_TELEMETRY_DISABLED = '1'
Remove-Item Env:NEXT_DIST_DIR -ErrorAction SilentlyContinue
Set-Location 'C:\logistika'

Write-Output "1/3 Server to'xtatilmoqda..."
Stop-ScheduledTask -TaskName 'Logistika Server' -ErrorAction SilentlyContinue
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
Start-Sleep -Seconds 2

Write-Output "2/3 Yig'ilmoqda (1-2 daqiqa)..."
$ErrorActionPreference = 'Continue'
cmd.exe /c "npm run build"
if ($LASTEXITCODE -ne 0) { Write-Output "XATO: yig'ish muvaffaqiyatsiz. Eski versiya qayta yoqiladi."; }
$ErrorActionPreference = 'Stop'

Write-Output "3/3 Server ishga tushirilmoqda..."
Start-ScheduledTask -TaskName 'Logistika Server'
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try { if ((Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { Write-Output "Tayyor: http://localhost:3000 ishlayapti."; exit 0 } } catch {}
}
Write-Output "Server 60 soniyada javob bermadi. Log: D:\logistika-data\logs"
exit 1

# Vazifa rejalashtiruvchisi (Task Scheduler) kompyuter yonganda shu skriptni ishga tushiradi.
. (Join-Path $PSScriptRoot "umumiy.ps1")
Set-Location $Root
New-Item -ItemType Directory -Force $LogDir | Out-Null
$log = Join-Path $LogDir "app.log"
if ((Test-Path $log) -and (Get-Item $log).Length -gt 10MB) { Move-Item $log (Join-Path $LogDir "app.old.log") -Force }
Refresh-Path
$env:NODE_ENV = "production"
# Dastur to'xtab qolsa, 10 soniyadan keyin qayta ishga tushiriladi.
while ($true) {
  "`n===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ishga tushdi =====" >> $log
  & node.exe "node_modules\next\dist\bin\next" start -H 127.0.0.1 -p $Port *>> $log
  "===== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') to'xtadi (kod $LASTEXITCODE) =====" >> $log
  Start-Sleep -Seconds 10
}

# Boshqa skriptlar uchun umumiy sozlamalar va yordamchi funksiyalar.
$Root      = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$PgVersion = "17"
$PgBin     = "C:\Program Files\PostgreSQL\$PgVersion\bin"
$Tailscale = "C:\Program Files\Tailscale\tailscale.exe"
$BackupDir = "C:\Logistika-zaxira"
$LogDir    = Join-Path $Root "logs"
$Port      = 3000
$TaskApp    = "Logistika server"
$TaskBackup = "Logistika zaxira"

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "    $text" -ForegroundColor Green }

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path", "User")
}

function Invoke-Checked {
  param([string]$File, [string[]]$Arguments)
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Xato: '$File $($Arguments -join ' ')' (kod $LASTEXITCODE)" }
}

function Read-DatabaseUrl {
  $envFile = Join-Path $Root ".env"
  $line = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if ($line -notmatch 'postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?"]+)') {
    throw "DATABASE_URL .env faylida topilmadi yoki tushunarsiz"
  }
  [pscustomobject]@{ User = $Matches[1]; Password = $Matches[2]; Host = $Matches[3]; Port = $Matches[4]; Db = $Matches[5] }
}

function Stop-App {
  Stop-ScheduledTask -TaskName $TaskApp -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like "*next*start*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

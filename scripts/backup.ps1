# PostgreSQL bazasining zaxira nusxasini D:\logistika-data\backups ga oladi.
# Oxirgi 14 kunlik nusxalar saqlanadi, eskilari o'chiriladi.
# Tiklash: pg_restore -h localhost -U logistika -d logistika --clean <fayl.dump>
$ErrorActionPreference = 'Stop'
$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
$backupDir = 'D:\logistika-data\backups'
$keepDays = 14
New-Item -ItemType Directory -Force $backupDir | Out-Null

# DATABASE_URL ni .env dan o'qiymiz
$line = Get-Content 'C:\logistika\.env' | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$url = ($line -replace '^DATABASE_URL=', '').Trim('"')

$file = Join-Path $backupDir ("logistika-{0:yyyy-MM-dd_HH-mm}.dump" -f (Get-Date))
& "$pgBin\pg_dump.exe" --dbname=$url -Fc -f $file
if ($LASTEXITCODE -ne 0) { throw "pg_dump xato kodi: $LASTEXITCODE" }

Get-ChildItem $backupDir -Filter 'logistika-*.dump' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$keepDays) } |
  Remove-Item -Force
Write-Output "Zaxira nusxa: $file"

# Bazaning zaxira nusxasini oladi. Har kuni 03:00 da avtomatik ishlaydi, qo'lda ham ishlatish mumkin.
# Oxirgi 30 ta nusxa saqlanadi. Qo'shimcha nusxa uchun loyiha papkasida
# zaxira-papka.txt fayliga boshqa papka yo'lini yozing (masalan fleshka yoki Google Drive papkasi).
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "umumiy.ps1")
$db = Read-DatabaseUrl
New-Item -ItemType Directory -Force $BackupDir | Out-Null
$file = Join-Path $BackupDir ("logistika-" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".dump")
$env:PGPASSWORD = $db.Password
Invoke-Checked (Join-Path $PgBin "pg_dump.exe") @("-U", $db.User, "-h", $db.Host, "-p", $db.Port, "-Fc", "-f", $file, $db.Db)
Remove-Item Env:PGPASSWORD

function Prune($dir) {
  Get-ChildItem $dir -Filter "logistika-*.dump" | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Force
}
Prune $BackupDir
$extraFile = Join-Path $Root "zaxira-papka.txt"
if (Test-Path $extraFile) {
  $extra = (Get-Content $extraFile -Raw).Trim()
  if ($extra -and (Test-Path $extra)) { Copy-Item $file $extra -Force; Prune $extra }
}
Ok "Zaxira saqlandi: $file"

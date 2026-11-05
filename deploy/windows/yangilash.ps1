#Requires -RunAsAdministrator
# GitHub dagi eng yangi kodni olib, dasturni qayta yig'adi va ishga tushiradi.
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "umumiy.ps1")
Set-Location $Root
Refresh-Path

Step "1/4 Yangilashdan oldin zaxira nusxa"
& (Join-Path $PSScriptRoot "zaxira.ps1")
Step "2/4 Yangi kodni olish"
Invoke-Checked "git" @("pull", "--ff-only")
Step "3/4 Dasturni qayta yig'ish"
Stop-App
Invoke-Checked "npm.cmd" @("ci")
Invoke-Checked "npx.cmd" @("prisma", "db", "push", "--skip-generate")
Invoke-Checked "npm.cmd" @("run", "build")
Step "4/4 Ishga tushirish"
Start-ScheduledTask -TaskName $TaskApp
Ok "Yangilandi"

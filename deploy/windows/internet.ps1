#Requires -RunAsAdministrator
# Dasturni Tailscale Funnel orqali internetga chiqaradi (doimiy https manzil, bepul).
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "umumiy.ps1")

Step "1/3 Tailscale hisobiga kirish (brauzer ochiladi, Google yoki boshqa hisob bilan kiring)"
& $Tailscale up --unattended   # allaqachon kirilgan bo'lsa, xato bersa ham davom etamiz

Step "2/3 Funnel ni yoqish"
Write-Host "    Agar quyida havola chiqsa, uni brauzerda ochib 'Enable' tugmasini bosing, keyin shu oynaga qayting."
Invoke-Checked $Tailscale @("funnel", "--bg", "$Port")

Step "3/3 Sizning manzilingiz"
& $Tailscale funnel status
Write-Host "`nYuqoridagi https://....ts.net manzilini telefon yoki boshqa kompyuterdan oching." -ForegroundColor Green

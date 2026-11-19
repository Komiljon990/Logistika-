# cloudflared xizmatini ishga tushirish (Administrator). Holat: D:\logistika-data\logs\tunnel-start.log
# cloudflared 32-bitli (Program Files (x86)): SYSTEM uchun uning "uy papkasi" SysWOW64\config\systemprofile bo'ladi,
# shuning uchun sozlama ikkala joyga yoziladi, kalit fayli esa C:\ProgramData\cloudflared da (faqat SYSTEM va adminlar).
param([string]$TunnelId = '1e1e130a-0874-4d24-91c4-e9c867c4ccb0')
$log = 'D:\logistika-data\logs\tunnel-start.log'
"=== $(Get-Date)" | Out-File $log -Encoding utf8
$data = 'C:\ProgramData\cloudflared'
New-Item -ItemType Directory -Force $data | Out-Null
Copy-Item "C:\Users\komil\.cloudflared\$TunnelId.json" "$data\$TunnelId.json" -Force
icacls $data /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
$cfg = @"
logfile: D:\logistika-data\logs\cloudflared.log
tunnel: $TunnelId
credentials-file: $data\$TunnelId.json
ingress:
  - hostname: crm.reyspro.uz
    service: http://localhost:3000
  - hostname: reyspro.uz
    service: http://localhost:3000
  - hostname: www.reyspro.uz
    service: http://localhost:3000
  - service: http_status:404
"@
foreach ($d in 'C:\Windows\SysWOW64\config\systemprofile\.cloudflared', 'C:\Windows\System32\config\systemprofile\.cloudflared') {
  New-Item -ItemType Directory -Force $d | Out-Null
  [IO.File]::WriteAllText("$d\config.yml", $cfg, (New-Object Text.UTF8Encoding $false))
  # Eski joydagi kalit nusxasi kerak emas.
  Remove-Item "$d\$TunnelId.json" -ErrorAction SilentlyContinue
}
"files: $((Get-ChildItem $data).Name -join ', ')" | Out-File $log -Append -Encoding utf8
try { Start-Service cloudflared -ErrorAction Stop; "start: ok" | Out-File $log -Append -Encoding utf8 } catch { "start: XATO $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8 }
Start-Sleep -Seconds 8
"status: $((Get-Service cloudflared).Status)" | Out-File $log -Append -Encoding utf8

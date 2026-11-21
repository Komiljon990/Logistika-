# Cloudflare Tunnel'ni Windows xizmati sifatida o'rnatish (18.11.2026). Administrator sifatida:
#   powershell -ExecutionPolicy Bypass -File C:\logistika\scripts\tunnel-service.ps1
# Tunnel "reyspro" (cloudflared tunnel create) va DNS yozuvlari (crm, @, www) oldindan yaratilgan.
# Xizmat SYSTEM nomidan ishlaydi va sozlamani systemprofile\.cloudflared dan o'qiydi.
param([string]$TunnelId = '1e1e130a-0874-4d24-91c4-e9c867c4ccb0', [string]$UserProfileDir = 'C:\Users\komil')
$ErrorActionPreference = 'Stop'
$cf = "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe"
$dir = 'C:\Windows\System32\config\systemprofile\.cloudflared'
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item "$UserProfileDir\.cloudflared\$TunnelId.json" "$dir\$TunnelId.json" -Force
$cfg = @"
tunnel: $TunnelId
credentials-file: $dir\$TunnelId.json
ingress:
  - hostname: crm.reyspro.uz
    service: http://localhost:3000
  - hostname: reyspro.uz
    service: http://localhost:3000
  - hostname: www.reyspro.uz
    service: http://localhost:3000
  - service: http_status:404
"@
[IO.File]::WriteAllText("$dir\config.yml", $cfg, (New-Object Text.UTF8Encoding $false))

if (Get-Service cloudflared -ErrorAction SilentlyContinue) {
  Stop-Service cloudflared -ErrorAction SilentlyContinue
  & $cf service uninstall 2>$null | Out-Null
  Start-Sleep -Seconds 2
}
& $cf service install 2>&1 | Out-Null
Start-Sleep -Seconds 3
Set-Service cloudflared -StartupType Automatic
Start-Service cloudflared -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5
"cloudflared xizmati: $((Get-Service cloudflared).Status)"

# Dastur sozlamalari: domen manzillari va HTTPS cookie.
$envFile = 'C:\logistika\.env'
$utf8 = New-Object Text.UTF8Encoding $false
$lines = [Collections.Generic.List[string]]::new()
foreach ($l in [IO.File]::ReadAllLines($envFile, $utf8)) { $lines.Add($l) }
$set = [ordered]@{ APP_URL = 'https://crm.reyspro.uz'; CRM_URL = 'https://crm.reyspro.uz'; SITE_HOSTS = 'reyspro.uz,www.reyspro.uz'; COOKIE_SECURE = 'auto' }
foreach ($k in $set.Keys) {
  $line = "$k=`"$($set[$k])`""
  $i = -1
  for ($j = 0; $j -lt $lines.Count; $j++) { if ($lines[$j] -match "^\s*$k\s*=") { $i = $j; break } }
  if ($i -ge 0) { $lines[$i] = $line } else { $lines.Add($line) }
}
[IO.File]::WriteAllLines($envFile, $lines, $utf8)

Stop-ScheduledTask -TaskName 'Logistika Server' -ErrorAction SilentlyContinue
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName 'Logistika Server'
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try { if ((Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { "Server ishlayapti."; break } } catch {}
}

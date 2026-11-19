# ReysPro'ni internetga chiqarish va xizmatlarni ulash (18.11.2026).
# Administrator PowerShell'da ishga tushiring:
#   powershell -ExecutionPolicy Bypass -File C:\logistika\scripts\internet-sozlash.ps1
#
# Maxfiy kalitlar (Telegram token, Brevo SMTP kaliti, Cloudflare tunnel tokeni) shu oynada yashirin kiritiladi -
# ular ekranda ko'rinmaydi, chatga yozilmaydi va faqat serverdagi C:\logistika\.env fayliga saqlanadi
# (Cloudflare tokeni Windows xizmatiga yoziladi). Har bosqichni Enter bosib o'tkazib yuborish mumkin.
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "Bu skriptni Administrator sifatida ishga tushiring." -ForegroundColor Red; exit 1 }

$EnvFile = 'C:\logistika\.env'
$Utf8 = New-Object System.Text.UTF8Encoding $false

function Read-Secret([string]$prompt) {
  $s = Read-Host -Prompt $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

function Set-EnvVar([string]$name, [string]$value) {
  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path $EnvFile) { foreach ($l in [IO.File]::ReadAllLines($EnvFile, $Utf8)) { $lines.Add($l) } }
  # Next.js .env ichida "$" ni o'zgaruvchi deb tushunadi - ekranlaymiz.
  $escaped = $value.Replace('\', '\\').Replace('"', '\"').Replace('$', '\$')
  $line = "$name=`"$escaped`""
  $idx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^\s*$([regex]::Escape($name))\s*=") { $idx = $i; break } }
  if ($idx -ge 0) { $lines[$idx] = $line } else { $lines.Add($line) }
  [IO.File]::WriteAllLines($EnvFile, $lines, $Utf8)
}

function Ask([string]$q) { return (Read-Host -Prompt $q).Trim() }

$changed = $false
Write-Host ""
Write-Host "=== ReysPro: internet, Telegram bot va pochta ===" -ForegroundColor Cyan
Write-Host "Har bosqichda Enter - o'tkazib yuborish."

# ---------- 1. Telegram bot ----------
Write-Host ""
Write-Host "1/4  Telegram bot" -ForegroundColor Yellow
Write-Host "     BotFather bergan tokenni kiriting (ekranda ko'rinmaydi)."
$tg = Read-Secret "     Token"
if ($tg) {
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $me = Invoke-RestMethod -Uri "https://api.telegram.org/bot$tg/getMe" -TimeoutSec 20
    if (-not $me.ok) { throw "javob ok emas" }
    Set-EnvVar 'TELEGRAM_BOT_TOKEN' $tg
    $changed = $true
    Write-Host "     OK: bot @$($me.result.username) ulandi." -ForegroundColor Green
  } catch {
    Write-Host "     XATO: token noto'g'ri yoki Telegram'ga ulanib bo'lmadi. Saqlanmadi." -ForegroundColor Red
  }
}
$tg = $null

# ---------- 2. Pochta (Brevo) ----------
Write-Host ""
Write-Host "2/4  Pochta (Brevo SMTP) - xatlar noreply@reyspro.uz nomidan" -ForegroundColor Yellow
Write-Host "     Brevo → SMTP & API → SMTP bo'limidagi 'Login' (masalan 8a1b2c001@smtp-brevo.com)."
$smtpUser = Ask "     SMTP login"
if ($smtpUser) {
  $smtpKey = Read-Secret "     SMTP kaliti (ekranda ko'rinmaydi)"
  $from = Ask "     Jo'natuvchi manzil [noreply@reyspro.uz]"
  if (-not $from) { $from = 'noreply@reyspro.uz' }
  if ($smtpKey) {
    $ok = $true
    $test = Ask "     Sinov xati qaysi manzilga? (Enter - yubormaslik)"
    if ($test) {
      try {
        $c = New-Object Net.Mail.SmtpClient('smtp-relay.brevo.com', 587)
        $c.EnableSsl = $true
        $c.Credentials = New-Object Net.NetworkCredential($smtpUser, $smtpKey)
        $m = New-Object Net.Mail.MailMessage
        $m.From = New-Object Net.Mail.MailAddress($from, 'ReysPro')
        $m.To.Add($test)
        $m.Subject = 'ReysPro: sinov xati'
        $m.Body = "Pochta sozlandi. Bu xat 'Spam' papkasiga tushmagan bo'lsa - hammasi joyida."
        $m.BodyEncoding = [Text.Encoding]::UTF8
        $m.SubjectEncoding = [Text.Encoding]::UTF8
        $c.Send($m)
        Write-Host "     OK: sinov xati yuborildi ($test)." -ForegroundColor Green
      } catch {
        $ok = $false
        Write-Host "     XATO: xat yuborilmadi - $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "     Login/kalitni va Brevo'da reyspro.uz domeni tasdiqlanganini tekshiring." -ForegroundColor Red
      }
    }
    if ($ok) {
      Set-EnvVar 'SMTP_HOST' 'smtp-relay.brevo.com'
      Set-EnvVar 'SMTP_PORT' '587'
      Set-EnvVar 'SMTP_USER' $smtpUser
      Set-EnvVar 'SMTP_PASS' $smtpKey
      Set-EnvVar 'MAIL_FROM' "ReysPro <$from>"
      $changed = $true
      Write-Host "     Saqlandi." -ForegroundColor Green
    }
  }
  $smtpKey = $null
}

# ---------- 3. Cloudflare Tunnel ----------
Write-Host ""
Write-Host "3/4  Internet (Cloudflare Tunnel)" -ForegroundColor Yellow
Write-Host "     Cloudflare → Zero Trust → Networks → Tunnels → Create tunnel (Cloudflared) → Windows."
Write-Host "     U yerda ko'rsatilgan buyruqdagi uzun tokenni (eyJ... bilan boshlanadi) kiriting."
$cft = Read-Secret "     Tunnel tokeni (ekranda ko'rinmaydi)"
if ($cft) {
  if ($cft -match '\s(eyJ\S+)') { $cft = $Matches[1] }  # butun buyruq qo'yilsa ham tokenni ajratamiz
  $exe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
  if (-not $exe) {
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")) { if (Test-Path $p) { $exe = $p } }
  }
  if (-not $exe) {
    Write-Host "     cloudflared o'rnatilmoqda..."
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements --silent | Out-Null
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $exe = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")) { if (-not $exe -and (Test-Path $p)) { $exe = $p } }
  }
  if (-not $exe) {
    Write-Host "     XATO: cloudflared o'rnatilmadi. https://github.com/cloudflare/cloudflared/releases dan o'rnatib, qayta ishga tushiring." -ForegroundColor Red
  } else {
    if (Get-Service cloudflared -ErrorAction SilentlyContinue) {
      Write-Host "     Eski cloudflared xizmati o'chirilmoqda..."
      & $exe service uninstall 2>$null | Out-Null
      Start-Sleep -Seconds 2
    }
    & $exe service install $cft 2>$null | Out-Null
    Start-Sleep -Seconds 5
    $svc = Get-Service cloudflared -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq 'Running') {
      Set-Service cloudflared -StartupType Automatic
      Write-Host "     OK: tunnel xizmati ishlayapti (kompyuter yoqilganda o'zi ishga tushadi)." -ForegroundColor Green
    } else {
      Write-Host "     XATO: tunnel xizmati ishga tushmadi. Tokenni tekshiring." -ForegroundColor Red
    }
  }
  $cft = $null
}

# ---------- 4. Domen manzillari ----------
Write-Host ""
Write-Host "4/4  Domen manzillari" -ForegroundColor Yellow
$dom = Ask "     Domen [reyspro.uz] (Enter - reyspro.uz, 'n' - o'tkazib yuborish)"
if ($dom -ne 'n') {
  if (-not $dom) { $dom = 'reyspro.uz' }
  Set-EnvVar 'APP_URL' "https://crm.$dom"
  Set-EnvVar 'CRM_URL' "https://crm.$dom"
  Set-EnvVar 'SITE_HOSTS' "$dom,www.$dom"
  # Domen orqali (HTTPS) - xavfsiz cookie; lokal tarmoqda (http://192.168.x.x:3000) ham kirish ishlaydi.
  Set-EnvVar 'COOKIE_SECURE' 'auto'
  $changed = $true
  Write-Host "     Saqlandi: sayt https://$dom , dastur https://crm.$dom" -ForegroundColor Green
}

# ---------- Qayta ishga tushirish ----------
if ($changed) {
  Write-Host ""
  Write-Host "Server qayta ishga tushirilmoqda..."
  Stop-ScheduledTask -TaskName 'Logistika Server' -ErrorAction SilentlyContinue
  $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
  Start-Sleep -Seconds 2
  Start-ScheduledTask -TaskName 'Logistika Server'
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try { if ((Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { Write-Host "Tayyor: server ishlayapti." -ForegroundColor Green; break } } catch {}
  }
}
Write-Host ""
Write-Host "Tugadi. Oynani yopishingiz mumkin."
Read-Host "Enter"

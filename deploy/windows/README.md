# Noutbukni sinov serveri sifatida ishlatish (Windows)

Bu yo'riqnoma Windows noutbukda Logistika dasturini ishga tushirib, uni internetdan
ochiladigan qiladi. Keyinchalik pullik serverga ko'chish oson: kod GitHub da,
ma'lumotlar esa har kungi zaxira faylida turadi.

**Muhim:** noutbuk doim yoqiq va zaryadga ulangan bo'lishi kerak. U o'chsa, sayt ham ochilmaydi.
Qopqoqni yopsangiz ham ishlayveradi (o'rnatish skripti shunday sozlaydi).

Kerak: Windows 10 yoki 11, internet, kamida 10 GB bo'sh joy.

## Bir martalik o'rnatish (taxminan 20-30 daqiqa)

1. **PowerShell ni administrator sifatida oching.** Start tugmasini bosing, `PowerShell` deb yozing,
   ustiga sichqonchaning o'ng tugmasini bosib **Run as administrator** ni tanlang.

2. **Git ni o'rnating.** Quyidagini ko'chirib, PowerShell ga qo'ying va Enter bosing:
   ```powershell
   winget install -e --id Git.Git
   ```
   Tugagach, PowerShell oynasini yoping va 1-qadamdagidek **qaytadan administrator sifatida** oching.

3. **Kodni yuklab oling:**
   ```powershell
   git clone https://github.com/Komiljon990/Logistika- C:\Logistika
   ```
   GitHub ga kirish oynasi chiqsa, o'z hisobingiz bilan kiring.

4. **O'rnatish skriptini ishga tushiring:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\Logistika\deploy\windows\ornatish.ps1
   ```
   Skript o'zi Node.js, PostgreSQL (baza) va Tailscale ni o'rnatadi, bazani yaratadi va dasturni yig'adi.
   Oxirida Super Admin telefon raqami va parolini so'raydi. Parol yozilayotganda ekranda ko'rinmaydi, bu normal.

5. **Tekshiring:** shu noutbukda brauzerda <http://localhost:3000> ni oching va kiring.

6. **Internetga chiqaring:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\Logistika\deploy\windows\internet.ps1
   ```
   Brauzer ochiladi: Tailscale ga Google (yoki boshqa) hisobingiz bilan kiring. Agar skript yana havola
   ko'rsatsa, uni ochib **Enable** ni bosing. Oxirida `https://....ts.net` ko'rinishidagi manzil chiqadi.
   Bu manzil doimiy, uni telefon yoki boshqa kompyuterdan ochish mumkin.

Shundan keyin hech narsa qilish shart emas: noutbuk qayta yonganda dastur ham, internet ham o'zi ishga tushadi.

## Har kuni avtomatik bo'ladigan ishlar

- Har kuni soat 03:00 da baza zaxira nusxasi `C:\Logistika-zaxira` papkasiga saqlanadi (oxirgi 30 kun).
  Noutbuk o'sha paytda o'chiq bo'lsa, keyingi yonishida oladi.
- Dastur to'xtab qolsa, 10 soniyadan keyin o'zi qayta ishga tushadi.

**Tavsiya:** noutbuk buzilsa zaxira ham yo'qolmasligi uchun nusxani boshqa joyga ham saqlang.
`C:\Logistika\zaxira-papka.txt` faylini yarating va ichiga boshqa papka yo'lini yozing
(masalan fleshka `E:\Logistika-zaxira` yoki Google Drive ning "Mirror files" rejimidagi papkasi).
Shunda har bir zaxira o'sha yerga ham nusxalanadi.

## Kerak bo'lganda

| Nima qilish kerak | Buyruq (administrator PowerShell da) |
|---|---|
| Yangi versiyani o'rnatish | `powershell -ExecutionPolicy Bypass -File C:\Logistika\deploy\windows\yangilash.ps1` |
| Hozir zaxira olish | `powershell -ExecutionPolicy Bypass -File C:\Logistika\deploy\windows\zaxira.ps1` |
| Zaxiradan tiklash | `powershell -ExecutionPolicy Bypass -File C:\Logistika\deploy\windows\tiklash.ps1 C:\Logistika-zaxira\FAYL_NOMI.dump` |
| Internet manzilini ko'rish | `& "C:\Program Files\Tailscale\tailscale.exe" funnel status` |

Yangilash skripti avval zaxira oladi, keyin GitHub dagi eng yangi kodni o'rnatadi.

## Muammo bo'lsa

- Dastur jurnali: `C:\Logistika\logs\app.log` (Bloknot bilan ochiladi).
- Skript qizil xato bilan to'xtasa, ekrandagi oxirgi 20-30 qatorni nusxalab yuboring.
- PostgreSQL bosh paroli `C:\Logistika\postgres-parol.txt` faylida turadi. Uni hech kimga yubormang.

## Pullik serverga ko'chish

1. `zaxira.ps1` bilan oxirgi zaxirani oling.
2. Yangi serverda kodni GitHub dan oling va bazani shu `.dump` fayldan tiklang (`pg_restore`).
3. Hammasi ishlagach, noutbukdagi vazifalarni o'chirish mumkin.

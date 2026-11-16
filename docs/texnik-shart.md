# Logistika boshqaruv tizimi — Texnik shart (TZ)

Oct 5, 2026 · @Komiljon

Bu hujjat O'zbekistondagi logistika tashkilotlari uchun ko'p tashkilotli
boshqaruv tizimining yagona talablar manbasi: nima kelishilgan, nima
ochiq, nima qurilgan.

## 1. Maqsad va doira

Tizim logistika rahbariyatiga "qayerda pul topyapmiz, qayerda ortiqcha
xarajat qilyapmiz, qaysi hujjat tugayapti, qaysi TIR/Dazvol
qaytarilmagan" savollariga javob beradi. U oddiy registr emas, nazorat
va boshqaruv vositasi.

- **Miqyos:** 10-15 logistika tashkiloti (o'sishi kutiladi), taxminan
  200 transport, har tashkilotda 2-3+ foydalanuvchi, markaziy
  buxgalteriyada 5+ buxgalter.

- **Platforma:** web dastur (AppSheet'dan voz kechilgan). Windows,
  Android va iOS brauzerida ishlaydi; telefonda kiritish va hujjat
  suratga olish, kompyuterda hisobot va tahlil qulay bo'ladi.

- **Uzoq muddatli yo'nalish:** tashkilotlarning buxgalteriyasi va
  faoliyatini avtomatlashtiruvchi bazaviy platforma; to'liq buxgalteriya
  hisobotlari keyinroq qo'shiladi.

- **Ustuvorlik tartibi:** 1) ma'lumot xavfsizligi, 2) hisob-kitob
  to'g'riligi, 3) foydalanuvchi huquqlari, 4) ma'lumot yo'qolmasligi, 5)
  qidirish qulayligi, 6) hisobot aniqligi, 7) telefon va kompyuterda
  qulaylik, 8) kengaytirish imkoniyati. Chiroyli ko'rinish mantiqiy
  to'g'rilikdan keyin turadi.

## 2. Rollar va huquqlar

Har bir foydalanuvchi alohida login va parol bilan kiradi; bitta loginni
ikki kishiga berish taqiqlangan. Rahbar va ishonchli vakil bir vaqtda
(biri telefondan, biri kompyuterdan) kira oladi, sessiyalari
bog'lanmaydi. Rol tizimi qattiq kodlanmaydi, keyinchalik buxgalter
huquqlari darajalarga bo'linishi mumkin.

| Rol                               | Ko'rish doirasi      | Kiritish / tahrirlash                                                                                       | O'chirish                                     |
|-----------------------------------|----------------------|-------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| Menejer (1-2 ta/tashkilot)        | Faqat o'z tashkiloti | Ha: transport, haydovchi, hujjat, fayl, TIR/Dazvol, tashish, xarajat, to'lov, ish haqi qoralamasi           | Faqat bekor qilish / arxivlash (status)       |
| Rahbar (1 ta/tashkilot)           | Faqat o'z tashkiloti | Yo'q, faqat ko'rish                                                                                         | Yo'q                                          |
| Ishonchli vakil (ixtiyoriy, 1 ta) | Faqat o'z tashkiloti | Yo'q, rahbar bilan bir xil, faqat ko'rish                                                                   | Yo'q                                          |
| Buxgalter (5+)                    | Barcha tashkilotlar  | Boshlang'ich bosqichda yo'q (ko'rish va hisobot); rasmiy ish haqini boshqaradi; kelajakda kengayishi mumkin | Yo'q                                          |
| Super Admin                       | Barcha tashkilotlar  | Tashkilot va foydalanuvchi yaratish, rol berish, bloklash, sozlamalar                                       | Fizik o'chirish faqat shu rolda va kamdan-kam |

Super Admin oddiy tashkilot foydalanuvchilaridan qat'iy ajratilgan va
boshidan kiritiladi.

## 3. Xavfsizlik va tashkilotlarni ajratish

Har bir tashkilot faqat o'z ma'lumotini ko'radi va boshqaradi. Bu faqat
interfeysda yashirish bilan emas, server tomonida majburiy filtrlash
bilan ta'minlanadi.

- Tashkilotga tegishli har bir jadvalda tashkilot identifikatori (orgId)
  bo'ladi.

- Menejer, rahbar va vakil uchun tashkilot har doim sessiyadagi
  foydalanuvchidan olinadi, so'rovdan emas: mijoz boshqa tashkilot
  identifikatorini yuborsa ham e'tiborga olinmaydi.

- Barcha ma'lumot so'rovlari bitta markaziy filtr funksiyasi orqali
  o'tadi; qo'lda filtr yozish taqiqlanadi.

- Buxgalter va Super Admin barcha tashkilotlarni ko'radi, xohlasa bitta
  tashkilotga filtrlaydi.

- Parollar xeshlanadi, sessiya imzolangan cookie orqali yuritiladi, har
  bir himoyalangan sahifa va amal avval foydalanuvchini tekshiradi.

- Ruxsat testi majburiy: noto'g'ri foydalanuvchi boshqa tashkilot
  ma'lumotini ko'ra olmasligi har modulda tekshiriladi.

## 4. Modullar va talablar

| Modul                            | Talablar                                                                                                                                                                                                                                                                                                                                      |
|----------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tashkilotlar va foydalanuvchilar | Tashkilot profili; hujjatlari: guvohnoma, ustav, litsenziya, bank rekvizitlari (ro'yxat kengayadi); foydalanuvchi, rol, bloklash.                                                                                                                                                                                                             |
| Transport                        | Davlat raqami, modeli, turi (tyagach, prisept, paravoz, boshqa; ro'yxat kengayadi). Mulkchilik: balansda yoki ijarada (egasi, ijara boshlanishi va tugashi, shartnoma). Standart juftlik: tyagach bilan prisept va haydovchi biriktiriladi. Chiqarilgan transport arxivlanadi va asosiy ro'yxatdan yashiriladi, kerak bo'lsa ochib ko'riladi. |
| Transport hujjatlari             | Texpasport, mulkchilik hujjati, ijara shartnomasi: ma'lumot + majburiy fayl. Litsenziya: ixtiyoriy fayl. Sug'urta, dopusheniya, texnik ko'rik, taxograf sertifikati: faqat ma'lumot (raqam, berilgan sana, muddat, izoh), fayl ixtiyoriy.                                                                                                     |
| Haydovchilar                     | FIO, telefon, toifa (xodim yoki o'z transportida ishlovchi), bitta tashkilotga tegishli. Hujjatlar: pasport, zagran pasport, guvohnoma, ADR, sertifikat, viza, boshqa. Ishdan ketsa arxivlanadi.                                                                                                                                              |
| TIR / Dazvol registri            | Alohida nazoratli kitob. Holatlar: omborda, foydalanishda, qaytarilgan. Haydovchiga berilganda: kimga, qachon, qaysi tashishga, qaytarish muddati, qaytarilgan sana. Qaytarilmagan (muddati o'tgan) hujjatlar alohida ro'yxatda. Rahbar omborda mavjud TIR/Dazvolni ko'radi.                                                                  |
| Tashishlar                       | Yo'nalish, tyagach, prisept, haydovchi, yuklangan sana, yuk haqida qisqa ma'lumot. Tyagach tanlansa prisept va haydovchi avtomatik chiqadi, qo'lda almashtirish mumkin. Bir tashishda bir nechta yuk qismi (SMR, har biri alohida mijoz). Hujjatlar: putyovka, CMR/SMR, Dazvol, TIR, boshqa (fayl yuklanadi).                                 |
| Tashish moliyasi                 | SMR bo'yicha haqiqiy narx va alohida buxgalteriya narxi, qo'shimcha xarajat, prostoy, qism-qism to'lovlar, qoldiq; tashkilotning o'z xarajatlari alohida. Batafsil 5-bo'limda.                                                                                                                                                                |
| Safar kunlari va tarif           | Chegara sanalaridan kunlarni avtomatik hisoblash, tashkilot tariflari bo'yicha safar xarajati. Batafsil 5-bo'limda.                                                                                                                                                                                                                           |
| Haydovchi to'lovlari             | Faqat o'z transportida ishlovchi haydovchilar: sabab (a'zolik, TIR, Dazvol, qo'shimcha, boshqa), sana, summa, turi (naqd, karta, xizmat haqidan ushlab qolingan). Buxgalteriyaga aloqasi yo'q, faqat ichki o'zaro hisob.                                                                                                                      |
| Ish haqi                         | Faqat xodim-haydovchilar. Ikki qatlam: qoralama (menejer kiritadi, ichki nazorat) va rasmiy (buxgalter boshqaradi, hisobotlarda aks etadi). Davr, hisoblangan, to'langan, to'lov sanasi, qolgan, izoh. Dastlab qo'lda, keyin avtomatlashtiriladi.                                                                                             |
| Mijozlar                         | Hozircha yuk beruvchi: tashkilot nomi, vakil, telefon (SMR ichida). Kelajakda alohida mijozlar bazasi.                                                                                                                                                                                                                                        |

## 5. Asosiy biznes qoidalar

### Tashish narxi va qoldiq

- Har bir yuk qismi (SMR) alohida mijoz, alohida narx va alohida
  faktura. Odatda tashishda bitta yuk qismi bo'ladi, lekin tuzilma
  boshidan "bittadan ko'p" ga mo'ljallanadi.

- **Qoldiq = (barcha SMR haqiqiy narxlari + qo'shimcha xarajatlar +
  prostoy) − to'lovlar.** Nol bo'lsa to'liq to'langan, musbat bo'lsa
  to'lanmagan summa.

- Prostoy = kunlar soni × bir kunlik summa. To'lovlar bir nechta
  bo'lishi mumkin (sana, summa, turi: naqd, karta, bank).

- **Buxgalteriya narxi** har SMR uchun alohida maydon. U qoldiq va
  boshqa hisob-kitoblarga aralashmaydi, faqat o'zining hisobotida
  ko'rinadi.

- Ikki xarajat ro'yxati hech qachon aralashmaydi: *qo'shimcha xarajat*
  mijozga hisoblanadi va summani oshiradi; *tashish xarajati* (yo'l,
  bojxona, yoqilg'i, parking, boshqa) tashkilotning o'z sarfi, faqat
  nazorat va tahlil uchun. Xarajat turlari kengayadi.

- Qoralama va rasmiy hisob parallel yuritiladi (narx va ish haqida ikki
  qatlam).

### Safar kunlari va tarif

Hisob barcha haydovchilar uchun yuritiladi, haydovchi toifasidan qat'i
nazar.

- O'zbekistondan chiqish kuni = XORIJ kuni. O'zbekistonga kirish kuni =
  O'ZBEKISTON kuni. Oradagi kunlar = XORIJ.

- Garaj kunlari (garajda turgan kunlar) to'lanmaydi.

- Uch tarif: O'zbekiston, SNG, Yevropa. Mintaqa yo'nalishning yakuniy
  manzilidan avtomatik aniqlanadi (masalan Toshkent-Polsha = butun xorij
  davri Yevropa tarifida). Davlat bo'yicha alohida tarif yo'q.

- Tariflarni har tashkilot o'zi belgilaydi, o'zgaruvchan, sana bilan
  tarixlanadi: eski tashishlar hisobi o'zgarmaydi.

- **Safar xarajati = O'zbekiston kunlari × O'zbekiston tarifi + xorij
  kunlari × (SNG yoki Yevropa) tarifi**, har biri tashish sanasidagi
  amaldagi tarif bo'yicha.

- Chegara kesib o'tish sanalari (chiqish va kirish) va garaj
  chiqish/qaytish sanalari tashishga kiritiladi, kunlar jurnali
  avtomatik tuziladi.

### Haydovchi toifalari

- **Xodim-haydovchi:** tashkilot xodimi, har bir tashishga belgilangan
  summa oladi, oyiga yig'ilib ish haqiga tushadi.

- **O'z transportida ishlovchi:** mustaqil daromad qiladi, a'zolik
  badali va olgan TIR/Dazvol uchun tashkilotga to'laydi. Bu hisob
  buxgalteriya va umumiy hisobotlardan tashqarida, faqat haydovchi
  kartochkasida shaxsiy balans sifatida ko'rinadi.

- Ikki toifa aralashtirilmaydi.

### Valyuta (yo'nalish kelishilgan, tafsilot ochiq)

So'm, yevro, dollar, rubl, qozoq tengasi. Har valyuta alohida
hisoblanadi va hisobotda alohida ustunda turadi. Rasmiy buxgalteriya
so'mda, Markaziy bank kursi bilan; qoralama asosan dollarda; umumiy
ko'rinishda barcha valyuta MB kursi bilan dollarga o'girilib taqribiy
jami ko'rsatiladi.

## 6. Umumiy mexanizmlar

- **Hujjat = ma'lumot + fayl, alohida.** Hujjat ma'lumotlari (tur,
  raqam, berilgan sana, muddat, izoh) fayldan mustaqil saqlanadi; skan
  majburiy emas (PDF, JPG, PNG, storage tejaladi). Majburiy fayl faqat
  4-bo'limda ko'rsatilgan hujjatlarda.

- **Versiyalash va arxiv.** Hujjat yangilansa eski yozuv o'chirilmaydi:
  yangisi FAOL, eskisi ARXIV (masalan Litsenziya №1001 arxivga, №2001
  faol). Bu transport, haydovchi, tashish va tashkilot hujjatlarining
  hammasiga bir xil qo'llanadi. Arxiv qidiriladi, filtrlanadi, qayta
  ko'riladi.

- **Fizik o'chirish yo'q.** To'lov, xarajat, tashish, TIR, Dazvol, ish
  haqi, hujjat: Faol, Bekor qilingan, Arxivlangan statuslari orqali;
  tarix saqlanadi. Fizik o'chirish faqat Super Admin'da.

- **Audit.** Moliyaviy ma'lumot, TIR/Dazvol, to'lov, ish haqi va
  hujjatlar uchun: kim kiritdi, kim o'zgartirdi, qachon, kim statusni
  o'zgartirdi, kim fayl yukladi.

- **Bildirishnoma.** Muddatli hujjatlar (transport, haydovchi, ijara,
  litsenziya, TIR/Dazvol qaytarish): 30, 15 va 7 kun qoldi, muddati
  o'tgan. Chegaralar sozlanadi.

- **Qidiruv.** Raqam, FIO, mijoz, yo'nalish, hujjat raqami bo'yicha,
  arxivni ham qamrab.

- **Telefon.** Ma'lumot kiritish, hujjatni suratga olib yuklash,
  transport, haydovchi, tashish, TIR/Dazvol, xarajat, to'lov.
  **Kompyuter:** katta jadvallar, hisobot, tahlil, buxgalteriya.

## 7. Hisobotlar va dashboard

| Hisobot                     | Mazmuni                                                                                                                                        |
|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Tushumlar                   | Davr, tashkilot, tashish, mijoz bo'yicha tushum, to'lov, qoldiq.                                                                               |
| Mijozlar                    | Har mijoz: tashishlar soni, jami summa, to'lovlar, qoldiq.                                                                                     |
| Haydovchilar                | Tashishlar, safar kunlari (O'zbekiston va xorij), xarajatlar, tashkilotga to'lovlar, ish haqi; haydovchilarni tejamkorlik bo'yicha taqqoslash. |
| Transportlar                | Tashishlar, xarajatlar, ishlatilish darajasi.                                                                                                  |
| Oylik xarajatlar vedomosti  | Tanlangan oy: har haydovchi, safar kunlari, O'zbekiston va xorij kunlari, tegishli xarajat, jami.                                              |
| Buxgalteriya narxi hisoboti | Faqat alohida maydondagi summa bo'yicha, boshqa moliyaviy hisobga aralashmaydi.                                                                |
| Muddatli hujjatlar          | Tugashiga qolgan kunlar, eng yaqin tugaydiganlar, muddati o'tganlar.                                                                           |

**Tashkilot dashboardi (rahbar):** transportlar soni, faol haydovchilar,
faol tashishlar, tugayotgan hujjatlar, omborda mavjud TIR/Dazvol va
qaytarilmaganlari, tushum, xarajat, qoldiq, qarzdorlik, oy statistikasi.

**Buxgalteriya dashboardi:** barcha tashkilotlar bo'yicha jami tashish,
tushum, xarajat, qoldiq; tashkilotlarni taqqoslash; haydovchilar,
transportlar, hujjat xavflari.

Hisobotlar valyuta bo'yicha alohida ustunlarda, taqribiy jami dollarda
beriladi (5-bo'lim).

## 8. Ma'lumotlar modeli (ishchi variant)

Sxema yakuniy emas: talablar tasdiqlanmaguncha qotirilmaydi. Hozirgi
ishchi variant prisma/schema.prisma faylida; quyida asosiy obyektlar va
bog'lanishlar.

| Obyekt                                    | Bog'lanish va muhim maydonlar                                                                                                             |
|-------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Tashkilot                                 | Barcha tashkilotga tegishli jadvallar orgId orqali bog'lanadi.                                                                            |
| Foydalanuvchi                             | Rol (Super Admin, Menejer, Rahbar, Ishonchli vakil, Buxgalter), tashkilot (Super Admin va Buxgalter uchun bo'sh), faollik.                |
| Transport                                 | Tashkilot; tur; mulkchilik; standart juft transport va standart haydovchi; status (faol, arxivlangan).                                    |
| Transport / haydovchi / tashkilot hujjati | Egasiga havola; tur, raqam, sanalar, izoh, ixtiyoriy fayl; status (faol, arxiv); oldingi versiyaga havola.                                |
| Haydovchi                                 | Tashkilot; toifa (xodim, o'z transportida); status.                                                                                       |
| TIR / Dazvol elementi                     | Tashkilot; tur; raqam; Dazvol uchun davlat; holat (omborda, foydalanishda, qaytarilgan); tashish, haydovchi, qaytarish muddati va sanasi. |
| Tashish                                   | Tashkilot; tyagach, prisept, haydovchi; tarif mintaqasi; status; garaj va chegara sanalari.                                               |
| Yuk qismi (SMR)                           | Tashishga bog'liq (1:ko'p); mijoz; haqiqiy narx; buxgalteriya narxi; valyuta.                                                             |
| Qo'shimcha xarajat, prostoy, to'lov       | Tashishga bog'liq; summa, valyuta, sana, to'lov turi.                                                                                     |
| Tashkilot xarajati                        | Tashishga bog'liq; kategoriya, summa, valyuta, sana (mijozga aloqasiz).                                                                   |
| Safar kunlari jurnali                     | Tashish va haydovchiga bog'liq; sana; kun turi (O'zbekiston, SNG, Yevropa).                                                               |
| Safar tarifi                              | Tashkilot; mintaqa; kunlik summa; valyuta; amal qilish boshlanishi va tugashi.                                                            |
| Haydovchi to'lovi                         | Tashkilot va haydovchi; sabab; summa; turi; sana.                                                                                         |
| Ish haqi yozuvi                           | Tashkilot va haydovchi; qatlam (qoralama, rasmiy); davr; hisoblangan; to'langan.                                                          |

Keyingi bosqichda qo'shiladi: audit jurnali, bildirishnoma sozlamalari,
valyuta kurslari, mijozlar bazasi, fayl saqlash.

## 9. Texnik arxitektura va stack

Arxitektura: brauzer (telefon va kompyuter) → web dastur → markaziy
ma'lumotlar bazasi. Kelajakdagi mobil ilova yoki bot ham shu bazaga
ulanadi.

| Qatlam             | Tanlov                                                            | Izoh                                                                                                                              |
|--------------------|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Web dastur         | Next.js 14 (App Router), TypeScript                               | Bitta kod bazasi, telefon va kompyuterda brauzerda ishlaydi, server tomonida ruxsat tekshiruvi.                                   |
| Ma'lumotlar bazasi | PostgreSQL, Prisma ORM                                            | Test uchun bepul bulut (masalan Neon), keyin istalgan serverga ko'chadi. Ko'p foydalanuvchi bir vaqtda yozishi uchun SQLite emas. |
| Kirish             | Parol xeshi (bcrypt), imzolangan sessiya cookie (JWT)             | Har foydalanuvchiga alohida login; sessiyalar bir-biriga bog'lanmaydi.                                                            |
| Ruxsat             | Markaziy orgScope filtri + rol tekshiruvi                         | Barcha so'rovlar shu orqali o'tadi.                                                                                               |
| Interfeys          | Tailwind CSS                                                      | Sodda, bo'sh joyli (zich emas) dizayn; telefon uchun moslashuvchan.                                                               |
| Fayllar            | Obyekt saqlash (S3 turidagi), bazada faqat havola                 | Hali qurilmagan; skan majburiy emas, storage tejaladi.                                                                            |
| Joylashtirish      | Test: mahalliy kompyuter; ishchi: bulut server (hali tanlanmagan) | Zaxira nusxa va domen keyinroq hal qilinadi.                                                                                      |

**Integratsiyalar (kelajak):** Mintrans (davlat raqami bo'yicha
litsenziya) faqat rasmiy API mavjud, ochiq va qonuniy bo'lsa; saytni
scraping qilish asosiy yechim sifatida taklif qilinmaydi. Markaziy bank
kursi (avtomatik yoki qo'lda, ochiq savol). Bank va buxgalteriya
dasturlari.

**Kengayish uchun joy qoldiriladi:** yoqilg'i nazorati, ta'mirlash,
shina hisoboti, GPS, mijozlar qarzdorligi, bojxona jarayonlari,
haydovchilar uchun bot yoki mobil ilova (yo'ldagi xarajat va safar
kunlarini kiritish), to'liq buxgalteriya hisobotlari (balans,
foyda-zarar).

## 10. Hozirgi holat va bosqichlar

### Qurilgan va sinalgan (13.11.2026, dastur nomi: ReysPro)

Sinov serveri: Windows noutbuk, PostgreSQL 16, ma'lumotlar `D:\logistika-data`
(baza, zaxira nusxalar, loglar). 75 ta avtomatik test va ishlab turgan serverda
165 ta tekshiruv o'tgan.

- **Kirish va rollar:** parol qo'lda tiklanadi (Super Admin — hammaning; rahbar —
  o'z tashkilotidagi menejer va vakilning). Markaziy tashkilot filtri.
- **Transport, haydovchilar, hujjatlar:** hujjat + fayl (rasm, PDF, Office, arxiv;
  10 MB), tez qo'shish (texpasport, litsenziya, texnik ko'rik, sug'urta; guvohnoma,
  pasport, zagran pasport, sertifikat), "Boshqa" turiga o'z nomi, muddatsiz hujjat,
  versiyalash. Transportni nofaol qilish; hujjatsiz va tashishsiz transportni o'chirish.
- **Tashkilot hujjatlari** (menejer, rahbar, buxgalter kiritadi).
- **Ogohlantirishlar:** muddati o'tgan / 7 / 15 / 30 kun; menejer va rahbar menyusida son.
- **Valyutalar:** har tashkilotda o'zi (rahbar boshqaradi); Markaziy bank kurslari.
- **Bosh sahifa:** kurslar va kechagiga nisbatan o'zgarish, 30 kunlik grafik,
  kalendar (tanlangan sana kursi), valyuta kalkulyatori (qo'lda kelishilgan kurs).
- **Mijozlar bazasi.**
- **Tashishlar:** yangi tashish (faqat bo'sh transport), qo'shimcha yuk (kartochkadan),
  mijoz va mas'ul shaxs, kelishuv (shartnoma / naqd), holatlar va chegara kunlari
  (menejer haydovchi o'rniga belgilaydi), tashish hujjatlari, bekor qilish.
- **Hisob-kitob:** qo'shimcha xarajat, prostoy, to'lovlar (bank / naqd / karta),
  qaysi tashish uchunligini tanlash, MB kursi katakda va qo'lda kelishilgan kurs,
  avans va uni qarzga yopish, naqd pul haydovchida yoki ofisda, kassaga topshirish,
  "Mijozlar bilan hisob-kitob" bo'limi.
- **Dizayn:** yorug' / qorong'i rejim (kontrast ≥ 5.7:1), xaritali fon, logo va ikonka.
- **Demo (reklama):** rahbar, menejer, buxgalter demo hisoblari; login sahifasida
  ko'rinadi; faqat demo tashkilotni ko'radi; server tomonida hech narsa saqlanmaydi.

- **14.11.2026:** yuqori panel (sozlamalar, ogohlantirishlar, oxirgi amallar),
  sozlamalar sahifasi, kassa (hisoblar, aylanma va davr hisoboti, xarajatlar
  turkum › bo'lim bilan, o'tkazmalar kurs bilan), to'lovlarda tushum hisobi,
  oxirgi amallar (ko'rish, ochish, o'chirish). Sinov: 95 ta unit test, kassa e2e
  (~100 tekshiruv) va oldingi e2e to'plamlari — hammasi o'tdi.

**Hali qurilmagan:** Telegram bot (token kutilmoqda), TIR/Dazvol registri (TIR
jadvalining maydonlari kerak), safar kunlari va tariflar hisobi, haydovchi
to'lovlari va ish haqi, hisobotlar.

### Xavfsizlik auditi (13.11.2026)

Tuzatilgan: Next.js 16.4.2 dagi xizmatni to'xtatish zaifligi (proxy orqali),
xavfsizlik sarlavhalari (CSP, clickjacking), rasm fayllari sandbox'da, zod
yangilandi, demo hisobni tashkilotsiz qoldirib bo'lmaydi, kurs so'rovlari 2 yil
bilan cheklangan, proxy so'rov hajmi 11 MB.

Tavsiyalar (ochiq): internetga chiqarishdan oldin HTTPS va `COOKIE_SECURE=true`;
`C:\logistika` papkasi huquqlarini cheklash; IP bo'yicha kirish urinishlarini
cheklash; Prisma 7 ga o'tish (CLI zanjiridagi zaiflik); zaxira nusxalarni
shifrlash; Office va arxiv fayllarini antivirus bilan tekshirish.

**Qurilgan (test qurilmasi, logistika-app.zip):** login va to'rt rol,
markaziy tashkilot filtri, transport moduli (ro'yxat, yaratish,
kartochka, hujjat versiyalash, arxivlash), dashboard, TIR/Dazvol
ro'yxati (faqat ko'rish), to'liq ishchi ma'lumotlar bazasi sxemasi va
namuna ma'lumotlar. Haydovchilar va Tashishlar sahifalari hozircha bo'sh
joy.

**Muhim:** kod qo'lda yozilgan, lekin ishga tushirilib sinalmagan
(yozish muhitida paket ombori bloklangan edi). Birinchi ish:
foydalanuvchi o'z kompyuterida ishga tushiradi, xatolar tuzatiladi.

**Bosqichlar:**

1.  Test qurilmasini ishga tushirish va tuzatish (npm install, prisma db
    push, db:seed, npm run dev).

2.  Foydalanuvchining Word hujjati (rahbar, buxgalter, menejer,
    haydovchilar fikri) bo'yicha TZ ni yangilash; funksiya emas,
    struktura o'zgarishi mumkin.

3.  Haydovchilar moduli (transport bilan bir xil andoza) va hujjat
    fayllarini yuklash.

4.  TIR/Dazvol amallari: omborga qabul, berish, qaytarish, nazorat; TIR
    jadvalining to'liq maydonlari (foydalanuvchi beradi).

5.  Tashishlar moduli: yuk qismlari (SMR), tyagach tanlaganda avtomatik
    to'ldirish, moliyaviy blok, tashish hujjatlari.

6.  Safar kunlari va tariflar: chegara sanalaridan kunlar jurnali, tarif
    tarixi, safar xarajati.

7.  Haydovchi to'lovlari va ish haqi (qoralama va rasmiy).

8.  Hisobotlar va dashboardlar; valyuta va kurs qoidalarini qotirish.

9.  Audit jurnali, bildirishnomalar, qidiruv va arxiv ko'rinishi.

10. Real ma'lumotga yaqin test, so'ng ishchi serverga joylashtirish.

**Har modul uchun majburiy testlar:** funksional, ruxsat (noto'g'ri
foydalanuvchi ko'ra olmaydi), hisob-kitob, ko'p foydalanuvchi bir
vaqtda, telefon va kompyuter ko'rinishi, ma'lumot yaxlitligi, arxiv
(eski hujjat yo'qolmaydi), bildirishnoma.

## 11. Ochiq savollar va takliflar

### Ochiq savollar (talab hali yakunlanmagan)

| Savol                                                                                                                                                                            | Nega muhim                                             |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------|
| Valyuta: kurs qo'lda kiritiladimi yoki Markaziy bankdan avtomatikmi; qaysi sanadagi kurs olinadi (tashish, to'lov yoki hisobot sanasi); valyuta har yozuvda alohida tanlanadimi? | Barcha moliyaviy maydon va hisobotlarga ta'sir qiladi. |
| Xodim-haydovchiga har tashish uchun belgilanadigan summa: har tashishda har xilmi, oy oxirida yig'ilib ish haqiga tushadimi?                                                     | Ish haqi va tashish modullari bog'lanishi.             |
| Garajdan chiqish va qaytish kunlari: chegara shu kuni kesilmasa kun qanday sanaladi?                                                                                             | Safar kunlari hisobining chegara holatlari.            |
| TIR jadvalining to'liq maydonlari (foydalanuvchi beradi).                                                                                                                        | TIR registri tuzilmasi.                                |
| Prostoy sababi (mijoz yoki haydovchi aybi) kerakmi?                                                                                                                              | Hozir faqat kun × summa.                               |
| Buxgalter huquqlari kelajakda qanday kengayadi (kiritish, tasdiqlash, darajalar)?                                                                                                | Rol tizimi.                                            |
| Mintrans: rasmiy API, ochiq endpoint, autentifikatsiya, foydalanish shartlari (test raqami 50991MBA).                                                                            | Integratsiya mumkinligi hali tekshirilmagan.           |
| Joylashtirish: qaysi server, zaxira nusxa, domen, fayl saqlash.                                                                                                                  | Ishchi rejimga o'tish.                                 |
| Word hujjatdagi fikrlar (rahbar, buxgalter, menejer, haydovchilar).                                                                                                              | Struktura o'zgarishi mumkin.                           |

### Ziddiyat va eslatmalar

- Dastlabki promptda haydovchi toifalari "A" (to'lovchi) va "B" (xodim)
  deb belgilangan, keyingi muhokamada teskari harf ishlatilgan. Bu
  hujjatda faqat nomlar ishlatiladi: *xodim-haydovchi* va *o'z
  transportida ishlovchi haydovchi*.

- Dastlab AppSheet tanlangan edi; web dastur bilan almashtirilgan.
  AppSheet bo'yicha eski qoidalar (Security Filter va h.k.) endi amal
  qilmaydi, ularning vazifasini 3-bo'limdagi server filtri bajaradi.

- Dastlabki promptdagi "alohida xarajat summasi" maydoni tashish
  darajasidan SMR darajasiga ko'chirilgan (5-bo'lim).

### Yangi talablar (13.11.2026, foydalanuvchidan)

- **Mijozlar bilan hisob-kitob** alohida bo'lim: har mijoz bo'yicha
  hisoblangan summa, to'lovlar, avans va qoldiq (qarz), valyuta
  bo'yicha alohida.
- **Tashish to'lov usuli ikki xil:** naqd va pul o'tkazish.
- **Valyutalar:** so'm, USD, EUR, ro'yxatga yangi valyuta qo'shish
  imkoni bilan.
- **To'lovlar ikki usulda qayd etiladi:** aniq tashish(lar)ga bog'lanadi
  (qisman ham) yoki avans sifatida mijozning umumiy hisobiga tushadi.
- **Naqd pulni** haydovchi ham, ofis kassasi ham qabul qilishi mumkin;
  kim qabul qilgani belgilanadi.
- **Parolni tiklash** (qurilgan): parol faqat qo'lda kiritiladi. Super
  Admin hammaning, tashkilot rahbari faqat o'z tashkilotidagi menejer va
  ishonchli vakilning parolini o'zgartiradi; rahbar va barcha
  tashkilotlar foydalanuvchilarining parolini faqat Super Admin.

### Qarorlar (13.11.2026, foydalanuvchi javoblari)

- **To'lov kelishuvi SMR'da belgilanadi:** *Shartnoma* (faqat tashkilot
  bank hisob raqamiga pul o'tkazish) yoki *Naqd kelishuv* (naqd pul
  yoki karta raqamiga). To'lov turi kelishuvga mos bo'lishi shart.
- **Valyutalar:** so'm, USD, EUR, rubl, tenge. Har tashkilotning o'z
  valyuta ro'yxati bo'ladi (biridagi valyuta boshqasida bo'lmasligi
  mumkin), uni **tashkilot rahbari** boshqaradi.
- **Mijozlar bazasi** hozirdan alohida, har tashkilotniki o'zida.
- **Qo'shimcha xarajat va prostoy SMR'ga bog'lanadi.**
- **Valyuta aralashishi mumkin:** narx bir valyutada kelishilib,
  boshqasida to'lanishi ko'p uchraydi. Kurs avtomatik Markaziy bank
  kursi (to'lov sanasidagi) bilan olinadi, qo'lda kelishilgan kurs
  bilan o'zgartirish mumkin. Qarzga qaysi kurs va summa bilan
  yopilgani to'lovda saqlanadi.
- **Avans:** mijoz qoldig'i = SMR qoldiqlari yig'indisi − taqsimlanmagan
  avans.

### Yangi talablar (13.11.2026, ikkinchi qism)

- **Tashish kiritishning ikki usuli:** *Yangi tashish* (ro'yxatda faqat
  bo'sh, yuki yo'q transportlar ko'rinadi) va *Qo'shimcha yuk* (tashish
  kartochkasidagi "Qo'shimcha yuk" tugmasi orqali mavjud tashishga yangi
  yuk qismi qo'shiladi; alohida tashish ochilmaydi).
- **Har yuk qismida (SMR):** mijoz (bazadan), mijoz tomondan mas'ul
  shaxsning F.I.O.si va telefon raqami.
- **Tashishlar ko'rsatilgan barcha ro'yxatlarda** (mijoz kartochkasi va
  boshqalar): tashish raqami, yo'nalish va tyagach raqami.
- **Haydovchi uchun Telegram bot.** Tashish kiritilgach haydovchiga
  xabar keladi va u holatlarni ketma-ket belgilaydi: qabul qildim →
  yuklash manziliga yetib keldim → yuklandi (dastlabki hujjatlarni
  biriktirish ixtiyoriy) → tushirish manziliga yetib keldim → yuk
  tushirildi. Shundan keyin transport bo'sh holatga o'tadi.
- **Bot orqali hujjat yuklab olish:** haydovchi tashkilotga, o'ziga va
  o'ziga biriktirilgan transportga tegishli hujjatlarni oladi.
- **Tashkilot hujjatlarini** menejer, rahbar va buxgalter kiritadi.
- **Fayl turlari:** rasm, PDF, arxiv (zip, rar, 7z), Microsoft Office
  (Word, Excel, PowerPoint). Hajmi 10 MB gacha.

### Ziddiyatlar (13.11.2026)

- 2-bo'limda **rahbar faqat ko'radi**, **buxgalter kiritmaydi**. Yangi
  talablar bo'yicha rahbar valyutalarni boshqaradi va tashkilot
  hujjatlarini kiritadi, buxgalter ham tashkilot hujjatlarini
  kiritadi. Yangi talablar ustun deb qabul qilindi; 2-bo'limdagi jadval
  shunga moslab yangilanishi kerak.
- 4-bo'limdagi "majburiy fayl" va 6-bo'limdagi fayl turlari (PDF, JPG,
  PNG) 10 MB va kengaytirilgan turlar bilan almashtirildi.

### Yangi talablar (13.11.2026, uchinchi qism)

- **Karta raqami** alohida maydon emas: kimning kartasiga tushgani
  to'lov izohiga yoziladi (masalan "Rahbar kartasiga").
- **Bot:** token foydalanuvchi beradi. Haydovchi botga yuborgan telefon
  raqami bo'yicha taniladi. **Nofaol (arxivlangan) haydovchiga bot hech
  qanday hujjat va ma'lumot bermaydi.**
- **To'lov qabul qilishda** boshqa valyutadagi to'lov uchun kurs katagi
  chiqadi: Markaziy bank kursi avtomatik qo'yiladi, kelishilgan kurs
  shu katakning o'zida o'zgartiriladi (alohida tugma yo'q).
- **To'lov qabul qilishda qaysi tashish(lar) uchun ekanini tanlash**
  mumkin; avtomatik taqsimlash (eng eski qarzdan) qo'shimcha imkoniyat.
- **Chegara kunlari bot orqali:** haydovchi O'zbekistondan chiqqan va
  O'zbekistonga kirgan kunni belgilaydi (safar kunlari hisobi uchun).
- **Menejer haydovchi o'rniga:** bot orqali belgilanadigan barcha
  amallarni (holatlar, chegara kunlari, hujjat biriktirish) menejer
  web platformadan ham kirita oladi (telefon buzilgan, internet yo'q,
  Telegram ishlatmaydi va h.k.). Kim kiritgani (haydovchi yoki menejer)
  saqlanadi.
- **Transport va haydovchilar:** hujjat biriktirish va muddat
  bo'yicha xabarlar ko'zga ko'rinadigan bo'lishi kerak (2-bosqichda
  hujjatlar faqat kartochka ichida, xabarlar faqat bosh sahifada edi).

### Yangi talablar va qarorlar (14.11.2026)

- **Yuqori panel:** sozlamalar (tishli g'ildirak belgisi), ogohlantirishlar
  (qo'ng'iroq, soni bilan) va "Oxirgi amallar" (soat belgisi) — alohida tugmalar.
- **Sozlamalar:** tashkilot hujjatlari, xodimlar, valyutalar va kassa
  sozlamalari asosiy menyudan sozlamalarga ko'chirildi.
- **Oxirgi amallar:** ko'rish, ochish (tahrirlash) va o'chirish. Qaror: har kim
  o'z amallarini ko'radi, rahbar — butun tashkilotniki ("faqat meniki" filtri bor).
  O'chirish = yaratilgan yozuvni bekor qilish (tarix saqlanadi) va faqat o'sha
  yozuvga huquqi bo'lsa.
- **Kassa (asosiy menyu):** bank hisob raqamlari (bank nomi, MFO, 20 xonali
  hisob raqami, valyuta), naqd kassalar, plastik kartalar (raqami va kimniki);
  har birida boshlang'ich qoldiq. Aylanma: kirim, chiqim, qoldiq; oy yoki
  ixtiyoriy davr bo'yicha hisobot, hisob bo'yicha filtr. Bo'limni rahbar
  sozlamalardan o'chirib-yoqadi (ma'lumot o'chmaydi).
- **Huquqlar (qaror):** hisob, xarajat, o'tkazmani hisobchi va menejer kiritadi;
  rahbar hammasini ko'radi va kassani yoqadi/o'chiradi, xarajat turkumlarini
  sozlaydi; ishonchli vakil faqat ko'radi.
- **Xarajatlar:** turkum › bo'lim (har tashkilot o'zi sozlaydi, namuna ro'yxat
  beriladi), summa, qaysi hisobdan kamayadi. Nofaol turkum yangi xarajatda
  chiqmaydi, eskilarida saqlanadi.
- **O'tkazmalar (qaror):** hisoblar orasida, valyutalar har xil bo'lsa kurs bilan
  (MB kursi avtomatik, katakda qo'lda o'zgartiriladi; asos — qimmatroq valyuta).
- **To'lovlar:** har to'lovda tushum qaysi hisobga tushgani ko'rsatiladi
  (bank → bank hisobi, karta → karta, naqd ofis → kassa, valyuta mos bo'lishi
  shart). Kassa yoqilgan va kamida bitta hisob ochilgan tashkilotda majburiy.
  Haydovchidagi naqd — qaror: kassaga topshirilganda kassa tanlanadi, kirim
  topshirilgan kuni. Eski to'lovlarga hisobni keyin ko'rsatish mumkin.

### Takliflar (talab emas, tasdiqlash kerak)

- Xarajatni tashish yoki transportga bog'lash (masalan, yoqilg'i — qaysi
  mashina yoki reys uchun), keyin reys foydaliligi hisobotida ishlatish.

- Mintaqani (SNG yoki Yevropa) qo'lda belgilash o'rniga yo'nalishdagi
  yakuniy mamlakatni ro'yxatdan tanlash, mamlakat mintaqasi sozlamada
  saqlanadi.

- Haydovchilar uchun yo'lda xarajat va chegara kesish sanasini
  kiritadigan sodda telefon sahifasi yoki bot (haydovchi o'zi sanani
  qayd etadi, menejer tasdiqlaydi).

- Bildirishnomalarni dastlab dashboardda va ro'yxatlarda ko'rsatish,
  keyin Telegram yoki SMS.

### Kirish tizimi va rollar (16.11.2026)

- Demo tashkilot ("ReysPro Demo Logistics") haqiqiy foydalanuvchilarning
  hech qaysi ro'yxatida ko'rinmaydi (Super Admin'da ham). Demo hisoblar
  faqat o'z demo tashkilotini ko'radi.
- Super Admin faqat tashkilot va uning rahbarini kiritadi: tashkilot nomi,
  STIR, e-mail, telefon, rahbar F.I.O.si. Rahbar e-maili uning logini
  bo'ladi. Super Admin tashkilot ma'lumotlarini (reyslar, kassa, mijozlar)
  ko'rmaydi.
- Menejer, buxgalter va ishonchli vakilni rahbar kiritadi: rol, F.I.O.,
  e-mail, telefon. "Barcha tashkilotlar buxgalteri" roli yo'q: buxgalter
  ham tashkilotga a'zo bo'ladi.
- Parol: foydalanuvchi e-mailiga kelgan 6 xonali kod orqali o'zi o'rnatadi
  va o'zi tiklaydi. Kod 15 daqiqa amal qiladi, 5 marta noto'g'ri
  kiritilsa bekor bo'ladi, 60 soniyada bir martadan va soatiga 5 tadan
  ko'p yuborilmaydi. Kod faqat e-mailga boradi (bepul). Telefon login
  sifatida va Telegram bot uchun ishlatiladi.
- Super Admin ham, rahbar ham boshqa birovning parolini tiklay olmaydi
  va uning hisobiga kira olmaydi.
- Vaqtincha parol: foydalanuvchi "Mening hisobim" sahifasida o'zi yaratadi.
  - Ruxsat turini (ko'rish yoki tahrirlash) va muddatini (1 soat, 8 soat,
    1 kun yoki 3 kun) tanlaydi, keyin parolni yordamchiga beradi.
  - "To'xtatish" bosilsa yoki muddat tugasa, shu parol bilan ochilgan
    sessiyalar darhol yopiladi.
  - Vaqtincha parol bilan kirgan kishi parol, e-mail va vaqtincha
    parollarni o'zgartira olmaydi. Banner har doim ko'rinib turadi.
- Bir e-mail bir nechta tashkilotda kiritilsa, bitta login bilan kiriladi
  va tashkilot tanlanadi. Ma'lumotlar jamlanmaydi: har tashkilot alohida
  sessiya a'zoligi orqali ochiladi.
- Ma'lumotlar modeli:
  - `Account`: shaxs (e-mail, telefon, parol);
  - `User`: tashkilotdagi a'zolik va rol;
  - `LoginCode`: bir martalik kodlar;
  - `AccessGrant`: vaqtincha parollar.
- E-mail Gmail SMTP orqali yuboriladi (.env: SMTP_*). Sozlanmaguncha xatlar
  D:\logistika-data\logs\email-outbox.log fayliga yoziladi (sinov rejimi).
- Foydalanuvchi qarori bilan demodan boshqa barcha tashkilot va
  foydalanuvchilar o'chirildi (zaxira:
  logistika-2026-11-16_10-06.dump). Super Admin qoldi.

### Ro'yxatdan o'tish, obuna va sayt (16.11.2026)

- Domenlar: reyspro.uz — ommaviy sayt, crm.reyspro.uz — dastur (login
  sahifasi bosh oyna). Bitta server: SITE_HOSTS domenlariga kelgan
  so'rovlar /site bo'limini ochadi, u yerda dastur sahifalari ochilmaydi.
- Login sahifasida demo hisoblar ostida "Ro'yxatdan o'tish" tugmasi.
  1-qadam: tariflar va ommaviy oferta, "qabul qilaman" belgisi.
  2-qadam: tashkilot nomi, STIR, rahbar F.I.O., telefon, e-mail
  (hammasi majburiy) — ariza yuboriladi. Spamdan himoya: yashirin maydon,
  bir IP'dan soatiga 3 ta, bir xil STIR/e-mail bilan kutilayotgan ariza
  bo'lsa — rad.
- Super Admin "Arizalar" bo'limida tasdiqlaydi yoki sabab bilan rad
  etadi. Tasdiqlansa: tashkilot faol, rahbar qo'shiladi, birinchi to'lov
  hisobi yaratiladi, rahbar e-mailiga vaqtincha parol (7 kun) va to'lov
  rekvizitlari boradi. Birinchi kirishda o'z parolini o'rnatmaguncha
  boshqa sahifa ochilmaydi. Super Admin parolni ko'rmaydi. Shaxsning
  ReysPro'da paroli bor bo'lsa — parol yuborilmaydi.
- Ariza tasdiqlangan kun — shartnoma (oferta) sanasi. Qabul qilingan
  oferta tahriri (OFFER_VERSION) va vaqti arizada saqlanadi.
- Tariflar (faol tyagachlar soni bo'yicha):
  - 10 tagacha — oyiga 100 000, yiliga 1 000 000 so'm;
  - 20 tagacha — 200 000 / 2 000 000;
  - 20 dan ko'p — 300 000 / 3 000 000.
  Yillik = 10 oy narxi, 12 oy foydalaniladi. 31.12.2027 gacha (shu kun
  ham) yaratilgan barcha to'lov hisoblariga 25% chegirma.
- Tarif chegarasidan ortiq faol tyagach qo'shib (yoki arxivdan
  qaytarib) bo'lmaydi. Prisep va boshqa transport hisobga kirmaydi.
- Obuna orasida transport kamaysa pul qaytarilmaydi. Tarif oshirilsa
  joriy davr oxirigacha qolgan qism uchun farq to'lanadi: yillikda qolgan
  har bir boshlangan oy uchun yillik farqning 1/12 qismi (misol: 9 oy,
  farq 1 000 000 → 750 000), oylikda qolgan kunlar ulushi (oy = 30 kun).
  Yangi tarif to'lov tasdiqlangach kuchga kiradi. Pastroq tarifga faqat
  uzaytirishda o'tiladi.
- Uzaytirish tugashiga 30 kun qolganda ochiladi, keyingi davr joriy
  davrdan keyin boshlanadi; tanlangan tarif faol tyagachlarga sig'ishi
  kerak.
- To'lov: bank o'tkazmasi. Rahbar yoki buxgalter "Sozlamalar → Obuna"da
  kvitansiyani yuklaydi → hisob "tekshiruvda"; Super Admin "To'lovlar"da
  tasdiqlaydi yoki sabab bilan rad etadi (rahbarga e-mail). Super Admin
  tashkilot fayllaridan faqat kvitansiyalarni ocha oladi.
- Yangi ariza va kvitansiya yuklanganda Super Admin Telegram botiga xabar
  (TELEGRAM_BOT_TOKEN .env'da, chat id Super Admin sozlamalarida).
- To'lanmagan hisob yoki muddat tugashiga 7 kun qolsa rahbar/buxgalterga
  banner. Muddat o'tsa avtomatik bloklanmaydi (Super Admin qaror qiladi).
- Oferta rekvizitlari (Ijrochi nomi, STIR, bank, MFO, hisob raqami...)
  Super Admin sozlamalarida; to'ldirilmaguncha ro'yxatdan o'tish yopiq.
  Oferta matni namuna — yurist ko'rib chiqishi kerak.
- Sayt: bosh sahifa (imkoniyatlar, narxlar), "Yangiliklar", "Qonun va
  qarorlar", "Foydali ma'lumotlar", oferta. Maqolalarni Super Admin
  "Sayt" bo'limida kiritadi (oddiy matn formati, manba havolasi,
  qoralama/e'lon).
- Ma'lumotlar modeli: `OrgApplication`, `Invoice`, `AppSetting`, `Post`;
  `Organization`ga plan, period, contractDate, subStart, subEnd;
  `Account`ga mustChangePassword, tempPasswordUntil.

## 12. Loyihada ishlash qoidalari (Claude uchun)

Bu bo'lim Project ko'rsatmasiga ko'chirilishi uchun yozilgan.

- Ushbu hujjat va asl MASTER PROMPT loyihaning yagona manbasi.
  Allaqachon kelishilgan talabni qayta so'rama va o'zgartirma; "bu
  maydon kerak", "skan majburiy emas", "rahbar faqat ko'radi", "har
  buxgalter alohida login" kabi qoidalar o'zgarmaydi.

- Noaniqlik yoki ziddiyat topilsa yashirma, 11-bo'limdagi ro'yxatga
  qo'sh. Yangi g'oyani "talab" va "taklif" sifatida alohida ko'rsat.

- Foydalanuvchi dasturchi emas, biznes jarayonni biladi. Texnik
  jargonsiz, oddiy tilda tushuntir; savollarni kerak bo'lgandagina,
  mavjud javoblarni takrorlamasdan so'ra.

- Bosqichma-bosqich ishla: avval talabni tahlil qil, keyin taklif ber,
  tasdiqdan keyin keyingi bosqichga o't. Ma'lumotlar bazasi sxemasini
  talab tasdiqlanmaguncha qotirma.

- Har yangi modul yoki oqim uchun dastur ko'rinishidan namuna (mockup)
  ko'rsat. Dizayn sodda va erkin joylashuvli, zich emas.

- Ustuvorlik: xavfsizlik, hisob-kitob to'g'riligi, huquqlar, ma'lumot
  yo'qolmasligi. Muhim ma'lumotni fizik o'chirma, status va arxiv
  ishlat.

- Har modulni "qurildi" deb hisoblama, 10-bo'limdagi testlardan
  o'tmaguncha. Ishga tushirib sinalmagan kodni sinalgan deb aytma.

- Javoblar o'zbek tilida.

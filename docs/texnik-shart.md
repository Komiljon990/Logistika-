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

19.11.2026 da qayta ko'rib chiqildi: javob berilganlari "Yopildi" deb
belgilandi va qaror qayerda yozilgani ko'rsatildi.

| Savol | Holat (19.11.2026) |
|-------|--------------------|
| Valyuta: kurs qo'lda yoki Markaziy bankdan; qaysi sanadagi kurs; valyuta har yozuvda alohidami? | **Yopildi.** MB kursi to'lov sanasida avtomatik qo'yiladi, shu katakning o'zida qo'lda o'zgartiriladi, ishlatilgan kurs to'lovda saqlanadi; har tashkilotning o'z valyuta ro'yxati (Qarorlar 13.11.2026, uchinchi qism 13.11.2026). |
| Xodim-haydovchiga har tashish uchun summa: har xilmi, oyiga yig'ilib ish haqiga tushadimi? | **Qisman.** Reys haqi haydovchi hisobiga yoziladi, avtomatik ham (18.11.2026). Ish haqi (qoralama va rasmiy) hisobiga qanday yig'ilishi — ochiq, ish haqi moduli bilan birga hal qilinadi. |
| Garajdan chiqish va qaytish kunlari: chegara shu kuni kesilmasa kun qanday sanaladi? | **Ochiq.** 18.11.2026 da chegara bosqichlari olib tashlandi (reys butunlay xorijda bo'lishi mumkin), safar kunlari hisobi esa chegara sanalariga tayanadi. 19.11.2026 qarori: safar kunlari va tarif hisobi hozircha qoldirildi; boshlashdan oldin shu savol hal qilinadi. |
| TIR jadvalining to'liq maydonlari. | **Yopildi (qurilgan).** TIR/Dazvol moduli holatlari va jurnali bilan ishlaydi (16.11.2026). Foydalanuvchi qo'shimcha ustun bersa kengaytiriladi. |
| Prostoy sababi (mijoz yoki haydovchi aybi) kerakmi? | **Yopildi (19.11.2026 qurildi).** 05.10.2026 dagi javob: sabab majburiy; haydovchi aybidagi prostoy hech kimga yozilmaydi (mijozga ham, haydovchidan ham). Prostoy kiritishda "Mijoz aybi / Haydovchi aybi" tanlanadi; haydovchi aybidagisi tashish kartochkasida chizilgan holda ko'rinadi, qoldiq, daromad va hisobotlarga kirmaydi. Sababi yozilmagan eski prostoylar mijoz aybi deb qoladi. |
| Buxgalter huquqlari qanday kengayadi? | **Qisman.** Buxgalter — tashkilot a'zosi, global emas (16.11.2026). Kiritish/tasdiqlash darajalari ish haqi moduli bilan aniqlanadi. |
| Mintrans: rasmiy API, autentifikatsiya, shartlar (test raqami 50991MBA). | **Ochiq.** Faqat rasmiy API orqali; tekshirilmagan. |
| Joylashtirish: server, zaxira, domen, fayl saqlash. | **Yopildi (sinov/ishchi rejim).** Server — foydalanuvchi noutbuki (Windows), ma'lumotlar `D:\logistika-data`, kunlik zaxira 14 kun saqlanadi, Cloudflare Tunnel: reyspro.uz — sayt, crm.reyspro.uz — dastur (18.11.2026). Pullik serverga o'tish keyinroq. |
| Word hujjatdagi fikrlar (rahbar, buxgalter, menejer, haydovchilar). | **Yopildi.** Foydalanuvchiga bunday hujjat noma'lum (05.10.2026) — mavjud emas deb hisoblanadi. |

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

### Kassa qo'shimchalari, TIR/dazvol, hisobotlar (16.11.2026)

- "Boshqa kirim-chiqim" (kassa bo'limi): tashishlardan tashqari pul —
  ta'sischi yoki rahbar o'z yonidan qo'ygan mablag', boshqa tashkilotdan
  yordam (kirim) yoki ularga qaytarilgan pul (chiqim). Kiritiladi: turi,
  kimdan/kimga, qaysi hisob, summa, sana, izoh. Xarajat turkumlariga
  kirmaydi. Model: `CashEntry`.
- Hisobda "Aylanmasini yuritmaslik" belgisi (masalan rahbar kartasi):
  unga o'tkazilgan pul (o'tkazma) ko'rinadi, lekin qayerga sarflangani
  kiritilmaydi. Bunday hisob kassa qoldig'i, aylanmasi va harakatlar
  ro'yxatida ko'rinmaydi; o'z sahifasida harakatlar tarixi saqlanadi
  (qoldiqsiz). Hisobotda unga o'tkazilgan pul alohida ustunda.
- Hisob ko'chirmasi: hisob sahifasida tanlangan oy yoki davr uchun
  boshlang'ich qoldiq, har bir kirim/chiqim vaqt tartibida va undan
  keyingi qoldiq, jami va oxirgi qoldiq. Chop etish / PDF.
- TIR karnet va dazvol: kirim (yuqori tashkilotdan; bir nechta raqam yoki
  oraliq bilan) → haydovchiga berish (tyagach + haydovchi, sana) →
  tashkilotga qaytarish (ishlatilgan / ishlatilmagan) → yuqori tashkilotga
  topshirish. Yo'qolgan/bekor belgisi. Har blankaning tarixi va davr
  bo'yicha harakatlar jurnali; muddati 30 kundan kam qolsa ogohlantirish.
  Menejer yuritadi, boshqalar ko'radi. Modellar: `Permit`, `PermitMove`.
- Hisobotlar: reyslar (transport, haydovchi, mijoz, yo'nalish bo'yicha
  soni va hisoblangan daromad), pul oqimi oylar bo'yicha (mijozlardan
  tushum, boshqa kirim, xarajatlar, boshqa chiqim, aylanmasiz hisoblarga,
  sof oqim), xarajatlar turkum bo'yicha, TIR/dazvol. Har valyuta alohida
  (so'mga aylantirilmaydi). Chop etish / PDF.

### Telegram bot: haydovchi tasdiqlashi (16.11.2026)

- TIR/dazvol amal qilish muddati kirimda majburiy; 30 kun qolganda TIR
  sahifasida va "Ogohlantirishlar"da ko'rinadi (tashkilotda yoki
  haydovchida turganlari).
- Haydovchi botga ulanadi: /start → "Telefon raqamni yuborish". Faqat
  o'z raqamini yuborgani qabul qilinadi va u ReysPro'dagi faol haydovchi
  telefoniga mos bo'lishi kerak. Haydovchi telefoni o'zgartirilsa,
  bog'lanish uziladi.
- Blanka haydovchiga berilganda ("Sizga ... berildi. Oldingizmi?") va
  qaytarilganda ("Siz ... topshirdingiz. To'g'rimi?") bot xabar yuboradi:
  "Tasdiqlash" / "Rad etish" tugmalari. Javob faqat xabar yuborilgan
  chatdan, bir marta qabul qilinadi. Holat TIR ro'yxati, blanka tarixi va
  jurnalda: javob kutilmoqda / tasdiqladi / rad etdi / botga ulanmagan.
- Rad etilgan blankalar TIR sahifasi tepasida ko'rsatiladi; "olmadim"
  deb rad etilgan berishni menejer bekor qila oladi (blanka yana
  tashkilotda, jurnalda izoh bilan).
- Bot serverning o'zida getUpdates (long polling) orqali ishlaydi —
  ochiq HTTPS manzil kerak emas. .env: TELEGRAM_BOT_TOKEN.
- Dazvol ikki xil: qog'oz yoki elektron (kirimda majburiy tanlanadi;
  ro'yxat, filtr, tarix va bot xabarida ko'rinadi).

### Mutaxassis roli (16.11.2026)

- Rahbar xodim qo'shganda "Mutaxassis" rolini tanlaydi va bo'limlarni
  belgilaydi: tashishlar, mijozlar, hisob-kitob, kassa, transport,
  haydovchilar, TIR/dazvol, tashkilot hujjatlari, hisobotlar. Har bo'lim
  uchun: "faqat ko'rish" yoki "kiritish, tahrirlash va o'chirish".
  Kamida bitta bo'lim majburiy.
- Bir nechta bo'lsa Mutaxassis-1, Mutaxassis-2 … deb nomlanadi; raqam
  xodimga bir marta beriladi va o'zgarmaydi.
- Mutaxassis menyuda faqat ruxsat berilgan bo'limlarni ko'radi; bosh
  sahifasi — birinchi ruxsat berilgan bo'lim. Boshqa sahifa va amallar
  serverda ham yopiq. Ruxsat o'zgarsa darhol (shu sessiyada ham) amal
  qiladi. Sozlamalar, ogohlantirishlar, xodimlar, valyutalar unga yopiq.
- Boshqa rollarning huquqlari o'zgarmagan.
- Model: `User.specialistNo`, `User.access` (JSON: bo'lim → VIEW/EDIT).
- TIR va Dazvol — alohida menyu, alohida huquq bo'limi va alohida hisobot.
  Holatlar: Yangi, Haydovchida, Ishlatilgan, Qaytarilgan (ishlatilmay
  qaytgan — qayta beriladi), Topshirilgan, Yo'qolgan, Brak.

### Tashishni tahrirlash, "faqat ro'yxat", ijarachilar (16.11.2026)

- Tashishni tahrirlash: yo'nalish, sana, yuk, izoh, tyagach/prisep/
  haydovchi (band transportga almashtirilmaydi), "faqat ro'yxat" belgisi.
  Yuk qismini tahrirlash: mijoz, mas'ul shaxs, yuk, CMR, shartnoma turi,
  narx, valyuta. To'lov taqsimlangan yuk qismida mijoz, valyuta va
  shartnoma turi o'zgarmaydi; narx to'langan summadan kam bo'lmaydi.
- "Faqat ro'yxat uchun" tashish: narx, xarajat, to'lov yuritilmaydi
  (narx 0), mas'ul shaxs ixtiyoriy. Mijoz qarzlari, hisob-kitob va daromad
  hisobotiga kirmaydi (hisobotda soni ko'rsatiladi). To'lov/xarajati bor
  tashishni bu rejimga o'tkazib bo'lmaydi; aksincha — barcha yuk
  qismlariga narx kiritilgach.
- Ijarachilar bilan hisob-kitob (alohida bo'lim): ijarachi (nomi,
  telefon, STIR); "Hisob qo'shish" — ijara haqi hisoblandi (qarz oshadi),
  "To'lov" — qarz kamayadi va tanlangan kassa hisobidan chiqim bo'ladi.
  Ixtiyoriy transport bog'lanadi. Qarz valyuta bo'yicha, ko'chirmada har
  yozuvdan keyingi qarz. Yozuv bekor qilinadi (o'chirilmaydi). Hisobchi
  va menejer yuritadi. Pul oqimi hisobotida to'lovlar xarajatga kiradi.
  Modellar: `Lessor`, `LessorEntry`; `Trip.listOnly`.
  **17.11.2026 da qayta ishlandi** — quyidagi bo'limga qarang.

### Haydovchilar hisob-kitobi, kirim, qidiruv, Excel (17.11.2026)

- **Ijarachilar = o'z transportidagi haydovchilar** (`Driver.category =
  OWNER_OPERATOR`): Haydovchilar bo'limidagilar shu yerda ham ko'rinadi;
  "Yangi ijarachi" shunday haydovchini yaratadi. Ijarachiga transport
  biriktiriladi (`Vehicle.ownerDriverId`, transport "ijarada" bo'ladi).
  "Hisob qo'shish": a'zolik to'lovi (tanlangan oy uchun, bir oyga bir
  marta), soliq, TIR uchun, dazvol uchun, boshqa — sana, summa, valyuta,
  ixtiyoriy transport va izoh bilan; ijarachining qarzi oshadi. "To'lov":
  sana, summa, valyuta, qayerga (kassa hisobi — kirim) va izoh; qarz
  kamayadi. "A'zolik to'lovini hammaga hisoblash" — tanlangan oy uchun
  barcha faol ijarachilarga bir xil summa (hisoblanganlar o'tkaziladi).
- **Hisob-kitob bo'limi ikki menyu**: "Mijozlar bilan" (avvalgidek) va
  "Haydovchilar bilan" — xodim haydovchilar (`EMPLOYEE`). "Hisob qo'shish":
  bajargan reysi uchun (reys tanlanadi, bitta reys bir marta) yoki
  qo'shimcha hisob / boshqa; bizning qarzimiz oshadi. "To'lov" —
  haydovchiga to'langan pul, tanlangan hisobdan chiqim.
- Ikkala tur bitta model: `DriverEntry` (side LESSOR/STAFF, kind
  CHARGE/PAYMENT, type MEMBERSHIP/TAX/TIR/DAZVOL/TRIP/BONUS/OTHER,
  period, tripId, accountId). Yozuv bekor qilinadi (o'chirilmaydi).
  Kassada: ijarachidan to'lov — "Kirim · ijarachidan", haydovchiga to'lov
  — "Chiqim · haydovchiga". Pul oqimi hisobotida alohida ustunlar.
  `Lessor`/`LessorEntry` modellari olib tashlandi (ma'lumot yo'q edi).
- **Tashish formasi**: tyagach, prisep yoki haydovchidan bittasi tanlansa,
  qolganlari tyagach kartochkasidagi standart bog'lamadan to'ldiriladi
  (tahrirlashda ham). "Qayerdan/qayerga" — avval kiritilgan joylar
  ro'yxati (ko'p ishlatilgani birinchi), 1-2 harf yozilsa filtrlanadi.
- **Yuqori panel**: global qidiruv (tashish raqami/yo'nalishi/yuk/CMR,
  mijoz nomi/STIR/telefon, haydovchi, davlat raqami, TIR/dazvol raqami —
  foydalanuvchi ko'ra oladigan bo'limlardan) va "+ Kirim" tugmasi: kimdan
  (mijoz / ijarachi / boshqa), qancha, qayerga (hisob), sana, izoh.
  Mijozdan tushum shu valyutadagi eng eski qarzlarga avtomatik
  taqsimlanadi (hisob turi to'lov usulini belgilaydi: bank — shartnoma,
  naqd/karta — naqd kelishuv), ortgani avans.
- **Hisobotlar**: "Ijarachilar" (hisob turi bo'yicha hisoblangan,
  to'langan, bugungi qarz) va "Haydovchilar" menyulari.
- **Excel**: bo'limlardagi jadvallar (tashishlar, mijozlar, transport,
  haydovchilar, hisob-kitob, ijarachilar, kassa, ko'chirmalar, TIR/dazvol,
  jurnal, hisobotlar) ekranda ko'ringan holatda (filtr/saralash bilan)
  .xlsx faylga yuklanadi. Summalar Excelda son bo'lib qoladi, valyuta
  formatda ko'rinadi.
- **TIR va dazvol — bitta menyu bandi** ("TIR / Dazvol"), ichida ikki
  menyu: TIR va Dazvol (ruxsatlar avvalgidek alohida).

### Avtomatik hisoblar, import, internet (18.11.2026)

- **Band haydovchi**: yukli faol tashishdagi haydovchi yangi tashish
  formasida ko'rinmaydi va tanlab bo'lmaydi (server ham tekshiradi,
  tahrirlashda ham).
- **Manzil "Shahar (Davlat)"**: masalan "Toshkent (Uzbekistan)". 471 shahar,
  48 davlat ma'lumotnomasi (`src/lib/places-core.ts`, o'zbekcha/ruscha/
  inglizcha nomlar). Ma'lumotnomadagi shahar yozilsa davlat avtomatik
  qo'shiladi; boshqa joy uchun davlat qavsda yoziladi.
- **Tashish bosqichlari**: "O'zbekistondan chiqdi / kirdi" olib tashlandi
  (tashish butunlay xorijda bo'lishi mumkin). Zanjir: qabul qildi →
  yuklashga yetdi → yuklandi → tushirishga yetdi → tushirildi; tashish
  tushirilganda yakunlanadi. Eski yozuvlar bazada qoladi.
- **Avtomatik hisob**: xodim haydovchi — "reys haqi" (tashish
  yakunlanganda); ijarachi — "oylik a'zolik" (har oy, joriy oydan;
  `Driver.tripRate/membershipFee`). Server har soatda tekshiradi
  (`AUTO_JOBS=off` — o'chirish).
- **Telegram bot**: haydovchiga yangi reys xabari, «🚚 Reysim» — bosqichni
  tugma bilan belgilash, «💰 Hisobim» — qarz; ijarachi/xodimga yangi hisob
  va to'lov haqida xabar.
- **Reys rentabelligi**: xarajatga ixtiyoriy "Reys" maydoni
  (`Expense.tripId`); tashish kartochkasida "Xarajatlar va foyda";
  Hisobotlar → "Reys rentabelligi" (daromad − xarajat − haydovchi haqi,
  valyuta bo'yicha).
- **Exceldan import** (`/import`): mijozlar, transport, haydovchilar —
  .xlsx yoki .csv, shablon, takrorlar o'tkaziladi, tarif chegarasi.
- **Bosh sahifa**: "Bugungi holat" — faol reyslar, mijozlar qarzi,
  ijarachilar qarzi, haydovchilarga qarzimiz; kurslar pastda.
  Mijozlar ro'yxatida "Qarz" ustuni.
- **Internet**: Cloudflare Tunnel (`scripts/internet-sozlash.ps1`);
  reyspro.uz — sayt, crm.reyspro.uz — dastur. `COOKIE_SECURE=auto` —
  HTTPS orqali Secure cookie, lokal tarmoqda oddiy. Pochta — Brevo SMTP,
  noreply@reyspro.uz (SPF, DKIM, DMARC — Cloudflare DNS).

### Telegram bot tashkilot xodimlari uchun (19.11.2026)

- Qaror: bot xodimlarga **faqat ko'rsatadi**, kiritish va o'zgartirish faqat saytda (telefon yo'qolsa ham
  ma'lumot o'zgarmaydi).
- Ulanish haydovchi bilan bir xil: /start → "Telefon raqamni yuborish". Raqam hisob telefoni yoki rahbar
  kiritgan a'zolik telefoniga mos bo'lishi kerak. Faqat shaxsiy chatda (guruhda ulanmaydi). Telefon
  o'zgarsa, xodim bloklansa yoki tashkilot nofaol bo'lsa — bog'lanish o'z-o'zidan bekor bo'ladi. "Mening
  hisobim"da holat va "Botdan uzish" tugmasi. Demo hisoblar ulanmaydi.
- Har xodim saytdagi roli va bo'lim huquqlari bo'yicha ko'radi; bir nechta tashkilotda bo'lsa — har
  tashkilot alohida (jamlanmaydi).
- Tugmalar: «📊 Bugun» (faol reyslar, mijozlar qarzi, ijarachilar qarzi, haydovchilarga qarzimiz, kassa
  qoldig'i), «🚚 Faol reyslar» (har biri qaysi bosqichda), «⚠️ Ogohlantirishlar», «🔎 Qidiruv» (yoki
  shunchaki matn yozish — saytdagi global qidiruv bilan bir xil). Havolalar dastur sahifasini ochadi.
- Har kuni 9:00 (Toshkent): muddati o'tgan va 7 kun ichida tugaydigan hujjatlar ro'yxati, 15/30 kunlik
  soni, haydovchi rad etgan TIR/dazvol, obuna eslatmasi (rahbar, buxgalter). Aytadigan gap bo'lmasa
  yuborilmaydi.
- Kirim (mijoz to'lovi, ijarachidan to'lov, boshqa kirim) — rahbar va buxgalterga xabar; kiritgan
  kishining o'ziga yuborilmaydi.
- Ogohlantirishlar mutaxassisga botda ham yopiq (saytdagi qoida bo'yicha). Haydovchi bosqich belgilaganda
  xodimlarga xabar — tanlanmadi (keyin qo'shish mumkin).
- Model: `Account.telegramChatId`, `telegramPhone`, `telegramLinkedAt`. Kod: `src/lib/telegram-staff.ts`.

### Keyinga qoldirilgan (19.11.2026)

- **Haydovchi joylashuvi Telegram orqali** (Live Location) va **AI yuk
  qidirish** bo'limi 13.11.2026 da kelishilgan (tafsiloti loyiha
  fayllaridagi TZ nusxasida), lekin foydalanuvchi qarori bilan hozircha
  qoldirildi. Keyin alohida bosqich sifatida qaytiladi.

### Bot tugmalari, matnlari va profili (19.11.2026, ikkinchi qism)

- Qaror (foydalanuvchi tanladi): bot tugmalar bilan ishlashda davom etadi; Mini App hozircha qilinmaydi.
- Haydovchi tugmalari: «🚚 Reysim», «💰 Hisobim», «📄 Hujjatlarim» (qo'lidagi, ya'ni berilgan va hali
  qaytarilmagan TIR/dazvol, muddati bilan), «☎️ Menejer» (faol reysni ochgan xodimning ismi va telefoni; faol
  reys bo'lmasa — tashkilot telefoni). Hammaga «❓ Yordam».
- /start (ulanmagan): «Xush kelibsiz» rasmi (`public/bot/xush-kelibsiz.jpg`, APP_URL orqali) va tugma.
  Ulanmagan odam boshqa narsa yozsa — ulanishni eslatadi; haydovchi tushunarsiz matn yozsa — tugmalarga yo'naltiradi.
- Buyruqlar (/start, /reys, /hisob, /hujjat, /menejer, /bugun, /reyslar, /ogohlantirish, /qidiruv, /yordam),
  qisqa va to'liq tavsif (o'zbekcha va ruscha) bot ishga tushganda Telegram'ga o'zi yoziladi
  (`src/lib/telegram-profile.ts`). Bot rasmi va tavsif rasmi BotFather'da qo'lda qo'yiladi.
- Taklif (talab emas): keyinchalik rahbar va menejer uchun Telegram Mini App (parolsiz kirish), haydovchi uchun
  rasm yuklash va joylashuv.

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

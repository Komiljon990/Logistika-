# Logistika

O'zbekistondagi logistika tashkilotlari uchun ko'p tashkilotli boshqaruv tizimi (web dastur).
Texnik shart: loyihaning "Texnik shart v2" hujjati.

## Hozirgi holat: 1-bosqich

- Telefon raqami va parol bilan kirish; 5 marta noto'g'ri parol kiritilsa 15 daqiqaga bloklanadi.
- Rollar: Super Admin, Buxgalter, Menejer, Rahbar, Ishonchli vakil.
- Markaziy tashkilot filtri (`src/lib/scope.ts`): menejer, rahbar va vakil faqat o'z tashkilotini ko'radi.
- Super Admin paneli: tashkilotlar va foydalanuvchilar, bloklash, parolni tiklash.
- Uch til: o'zbek (lotin), o'zbek (kirill), rus.
- Admin amallari audit jurnaliga yoziladi.

## Ishga tushirish (dasturchi uchun)

```bash
cp .env.example .env          # DATABASE_URL va SESSION_SECRET ni to'ldiring
npm install
npx prisma db push
SEED_ADMIN_PHONE="+998901234567" SEED_ADMIN_PASSWORD="..." npm run db:seed
npm run dev
```

`SEED_DEMO=1` qo'shilsa, namuna tashkilot va 3 foydalanuvchi yaratiladi.

## Tekshiruvlar

```bash
npm run lint   # TypeScript
npm test       # testlar (PostgreSQL kerak)
```

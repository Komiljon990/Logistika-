import { PLANS, PROMO_PERCENT, PROMO_UNTIL } from "./billing-core";
import type { Provider } from "./settings";

/**
 * Ommaviy oferta matni (namuna — yurist ko'rib chiqishi tavsiya etiladi). Matn o'zgarsa OFFER_VERSION
 * yangilanadi: har arizada qaysi tahrir qabul qilingani saqlanadi.
 */
export const OFFER_VERSION = "2026-11-17";

export const som = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ")} so'm`;

const promoDate = PROMO_UNTIL.split("-").reverse().join(".");

export function planLabel(id: string): string {
  const p = PLANS.find((x) => x.id === id);
  if (!p) return id;
  return p.limit === null ? `${PLANS[PLANS.length - 2].limit} tadan ortiq transport` : `${p.limit} tagacha transport`;
}

export type OfferSection = { title: string; items: string[] };

export function offerSections(p: Provider): OfferSection[] {
  const prov = p.name || "[Ijrochi nomi — Super Admin sozlamalarida kiritiladi]";
  const tariffs = PLANS.map((x) => `«${planLabel(x.id)}» — oyiga ${som(x.monthly)} yoki yiliga ${som(x.yearly)}.`);
  return [
    {
      title: "1. Umumiy qoidalar",
      items: [
        `Ushbu hujjat ${prov} (keyingi o'rinlarda — «Ijrochi») tomonidan ReysPro dasturidan foydalanish huquqini berish bo'yicha O'zbekiston Respublikasi Fuqarolik kodeksining 367, 369, 370-moddalariga muvofiq ommaviy oferta (taklif) hisoblanadi.`,
        "Saytda ro'yxatdan o'tish shaklida «Ommaviy oferta shartlarini o'qidim va qabul qilaman» belgisini qo'yib, ariza yuborgan yuridik shaxs yoki yakka tartibdagi tadbirkor (keyingi o'rinlarda — «Buyurtmachi») oferta shartlarini to'liq va so'zsiz qabul qilgan (aksept) hisoblanadi.",
        "Shartnoma Ijrochi arizani tasdiqlagan kundan boshlab tuzilgan hisoblanadi va shu sana shartnoma sanasi sifatida qayd etiladi. Shartnomani qog'ozda imzolash talab qilinmaydi.",
      ],
    },
    {
      title: "2. Shartnoma predmeti",
      items: [
        "Ijrochi Buyurtmachiga internet orqali ReysPro dasturidan (yuk tashish, transport, haydovchilar, hujjatlar, hisob-kitob va kassa hisobini yuritish tizimi) obuna asosida foydalanish huquqini beradi, Buyurtmachi esa obuna haqini to'laydi.",
        "Dastur «qanday bo'lsa, shundayligicha» taqdim etiladi; Ijrochi uni yangilash va takomillashtirish huquqiga ega.",
      ],
    },
    {
      title: "3. Obuna tariflari",
      items: [
        ...tariffs,
        "Yillik obuna 12 oyga beriladi va uning narxi 10 oylik to'lovga teng (2 oy bonus).",
        `${promoDate} gacha (shu kun ham) rasmiylashtirilgan oylik va yillik to'lovlarga ${PROMO_PERCENT}% chegirma beriladi.`,
        "Transportlar soni Buyurtmachining dasturdagi faol tyagachlari soni bilan hisoblanadi. Tarif chegarasidan ortiq faol tyagach qo'shish uchun tarifni oshirish kerak.",
        "Narxlar QQS bilan yoki QQSsiz ekani Ijrochining soliq rejimiga bog'liq va to'lov hisobida ko'rsatiladi. Ijrochi narxlarni o'zgartirishi mumkin; yangi narxlar joriy (to'langan) obuna muddatiga ta'sir qilmaydi.",
      ],
    },
    {
      title: "4. To'lov tartibi",
      items: [
        "To'lov Ijrochining quyida ko'rsatilgan bank hisob raqamiga pul o'tkazish yo'li bilan, dasturda yaratilgan to'lov hisobi raqami ko'rsatilgan holda amalga oshiriladi.",
        "To'lov amalga oshirilgach Buyurtmachi to'lov topshiriqnomasi yoki kvitansiyani dasturning «Obuna» bo'limiga yuklaydi. Ijrochi pul tushganini tekshirib, to'lovni tasdiqlaydi.",
        "Birinchi to'lov shartnoma sanasidan boshlab 10 (o'n) kalendar kuni ichida amalga oshiriladi. To'lov o'z vaqtida qilinmasa, Ijrochi dasturga kirishni to'lov qilinguncha cheklash huquqiga ega; Buyurtmachining kiritgan ma'lumotlari o'chirilmaydi.",
      ],
    },
    {
      title: "5. Obuna orasida tarifni o'zgartirish",
      items: [
        "Obuna davomida faol transportlar soni kamaysa, to'langan obuna haqi qaytarilmaydi va keyingi davrgacha joriy tarif amal qiladi.",
        "Transportlar soni ko'paysa, Buyurtmachi yuqori tarifga o'tadi va joriy obuna muddati oxirigacha qolgan davr uchun tariflar orasidagi farqni to'laydi. Yillik obunada qolgan har bir (boshlangan) oy uchun yillik narxlar farqining 1/12 qismi, oylik obunada qolgan kunlar ulushi hisoblanadi; to'lov kunida amaldagi chegirma qo'llanadi.",
        "Misol: Buyurtmachi «10 tagacha» tarifiga yillik obuna bo'lgan va obuna tugashiga 9 oy qolgan. «20 tagacha» tarifiga o'tmoqchi: yillik narxlar farqi 1 000 000 so'm, 9 oy uchun 750 000 so'm to'laydi va joriy obuna muddati oxirigacha 20 tagacha transport bilan ishlaydi.",
        "Yangi tarif to'lov tasdiqlangan kundan amal qiladi. Pastroq tarifga faqat keyingi obuna davridan o'tish mumkin.",
      ],
    },
    {
      title: "6. Tomonlarning huquq va majburiyatlari",
      items: [
        "Ijrochi: dasturning ishlashini ta'minlaydi; texnik ishlar haqida imkon qadar oldindan xabar beradi; Buyurtmachi ma'lumotlarini uchinchi shaxslarga bermaydi (qonunda belgilangan hollar bundan mustasno); ma'lumotlarning zaxira nusxasini muntazam saqlaydi.",
        "Buyurtmachi: ro'yxatdan o'tishda to'g'ri ma'lumot beradi; obuna haqini o'z vaqtida to'laydi; login va parollarni sir saqlaydi; dasturdan qonunga zid maqsadlarda foydalanmaydi; kiritilgan ma'lumotlarning to'g'riligi uchun o'zi javob beradi.",
        "Buyurtmachi o'z xodimlarini (menejer, buxgalter va boshqalar) dasturga o'zi qo'shadi va ularning harakatlari uchun javob beradi.",
      ],
    },
    {
      title: "7. Ma'lumotlar maxfiyligi",
      items: [
        "Buyurtmachi kiritgan ma'lumotlar faqat Buyurtmachi va u ruxsat bergan foydalanuvchilarga ko'rinadi. Ijrochi xodimlari Buyurtmachi ma'lumotlarini faqat Buyurtmachining o'zi bergan vaqtincha ruxsat bilan ko'radi.",
        "Shaxsga doir ma'lumotlar «Shaxsga doir ma'lumotlar to'g'risida»gi O'zbekiston Respublikasi Qonuniga muvofiq ishlanadi. Ariza yuborish bilan Buyurtmachi rahbari o'z ma'lumotlarini (F.I.O., telefon, e-mail) shartnomani bajarish maqsadida ishlashga rozilik beradi.",
      ],
    },
    {
      title: "8. Javobgarlik",
      items: [
        "Tomonlar majburiyatlarni bajarmaganlik uchun O'zbekiston Respublikasi qonunchiligiga muvofiq javob beradi.",
        "Ijrochi internet aloqasi, elektr ta'minoti uzilishi va boshqa o'ziga bog'liq bo'lmagan holatlar (fors-major) tufayli yuzaga kelgan uzilishlar uchun javob bermaydi. Ijrochining javobgarligi Buyurtmachi oxirgi obuna davri uchun to'lagan summa bilan cheklanadi.",
      ],
    },
    {
      title: "9. Shartnoma muddati va bekor qilish",
      items: [
        "Shartnoma to'langan obuna davri uchun amal qiladi va keyingi davr to'lovi bilan uzaytiriladi.",
        "Buyurtmachi istalgan vaqtda obunani uzaytirmaslik orqali shartnomani bekor qilishi mumkin; to'langan davr uchun pul qaytarilmaydi. Buyurtmachi so'rovi bilan uning ma'lumotlari elektron jadval ko'rinishida beriladi.",
        "Nizolar muzokara yo'li bilan, kelishilmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq sudda hal etiladi.",
      ],
    },
  ];
}

export function providerLines(p: Provider): [string, string][] {
  return [
    ["Nomi", p.name],
    ["STIR", p.inn],
    ["Rahbar", p.director],
    ["Manzil", p.address],
    ["Bank", p.bank],
    ["MFO", p.mfo],
    ["Hisob raqami", p.account],
    ["Telefon", p.phone],
    ["E-mail", p.email],
  ].filter(([, v]) => v) as [string, string][];
}

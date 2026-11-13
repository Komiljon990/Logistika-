/**
 * Fon: foydalanuvchi bergan logistika rasmi (public/bg-logistics.png) — o'zgarishsiz, harakatsiz.
 * Qorong'i rejimda rasm aynan o'zidek ko'rinadi. Yorug' rejimda to'q matn o'qilishi uchun ustidan oq parda tushadi.
 * Bezak — ekran o'quvchilardan yashirilgan.
 */
export function Background() {
  return (
    <div className="bg-photo-layer" aria-hidden="true">
      <div className="bg-photo-veil" />
    </div>
  );
}

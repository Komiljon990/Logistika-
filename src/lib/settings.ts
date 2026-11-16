import "server-only";
import { db } from "./db";

/** Xizmat ko'rsatuvchi (ReysPro egasi) rekvizitlari — ommaviy oferta va to'lov uchun. Super Admin kiritadi. */
export type Provider = {
  name: string;
  inn: string;
  director: string;
  address: string;
  bank: string;
  mfo: string;
  account: string;
  phone: string;
  email: string;
};

export const PROVIDER_FIELDS = ["name", "inn", "director", "address", "bank", "mfo", "account", "phone", "email"] as const satisfies readonly (keyof Provider)[];

const EMPTY: Provider = { name: "", inn: "", director: "", address: "", bank: "", mfo: "", account: "", phone: "", email: "" };

export async function getProvider(): Promise<Provider> {
  const row = await db.appSetting.findUnique({ where: { key: "provider" } });
  return { ...EMPTY, ...((row?.value as Partial<Provider> | null) ?? {}) };
}

export async function saveProvider(p: Provider) {
  await db.appSetting.upsert({ where: { key: "provider" }, create: { key: "provider", value: p }, update: { value: p } });
}

/** Rekvizitlar to'liqmi (bo'lmasa oferta "to'ldirilmagan" deb ko'rsatiladi va ro'yxatdan o'tish yopiq). */
export function providerReady(p: Provider): boolean {
  return !!(p.name && p.inn && p.bank && p.mfo && p.account);
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await db.appSetting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? null;
}

export async function setSetting(key: string, value: unknown) {
  await db.appSetting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
}

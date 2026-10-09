export function shopTelUrl(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const compact = phone.trim().replace(/[\s().-]/g, "");
  const number = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  return /^\+?[0-9]{7,15}$/.test(number) ? `tel:${number}` : null;
}

export async function openShopPhone(
  phone: string | null | undefined,
  openUrl: (url: string) => Promise<unknown>,
): Promise<string> {
  const url = shopTelUrl(phone);
  if (!url) {
    throw new Error(phone?.trim()
      ? "This shop's phone number is invalid. Please contact the shop another way."
      : "This shop has not provided a phone number.");
  }
  const number = url.slice(4);
  try {
    await openUrl(url);
  } catch {
    throw new Error(`A phone dialer could not be opened. Call ${number} from a phone instead.`);
  }
  return number;
}

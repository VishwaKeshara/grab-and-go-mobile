/** Formats a number as LKR currency, e.g. 1450 -> "LKR 1,450.00". */
export function formatCurrency(amount: number): string {
  return `LKR ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact currency for dense cards, e.g. 1450 -> "LKR 1,450". */
export function formatCurrencyShort(amount: number): string {
  return `LKR ${Math.round(amount).toLocaleString("en-LK")}`;
}

/** "2026-10-03" -> "3 Oct 2026". */
export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${date.toLocaleString("en-GB", {
    month: "short",
  })} ${date.getFullYear()}`;
}

/** Relative time for recent rows, e.g. "3h ago". */
export function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";

  const hours = Math.max(
    0,
    Math.round((Date.now() - timestamp) / 3600000),
  );
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
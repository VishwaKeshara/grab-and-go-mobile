import type { DiscountType } from "@/types/product";

/**
 * The minimum a row needs for the discount maths below. Both `DiscoveredProduct`
 * and `Product` satisfy it, so the customer screens and Shop Management read a
 * discount the same way.
 */
export type DiscountLike = {
  price: number;
  regular_price?: number | null;
  discount_percent?: number | null;
  discount_type?: DiscountType | null;
  discount_amount_lkr?: number | null;
};

/**
 * The pre-discount price every discount is calculated from.
 *
 * This is regular_price_lkr rather than price_lkr on purpose: once a discount is
 * applied price_lkr is already reduced, so taking a second discount off it would
 * compound instead of replacing. Falls back to price_lkr for rows with no
 * regular price recorded.
 */
export function basePrice(product: DiscountLike): number {
  return Number(product.regular_price ?? product.price ?? 0);
}

/**
 * Which of the two options is stored, falling back to "percent" for rows written
 * before migration 021 added discount_type.
 */
export function discountMode(product: DiscountLike): DiscountType {
  return product.discount_type === "fixed" ? "fixed" : "percent";
}

/**
 * The discount as a percentage.
 *
 * Derived from the price pair whenever nothing is stored, which covers two
 * cases: a fixed discount (the CHECK constraint in 021 forbids storing a
 * percentage alongside one, so the column is 0 by design) and a row written
 * before 019 added the column at all.
 */
export function discountPercent(product: DiscountLike): number {
  const stored = Number(product.discount_percent ?? 0);
  if (stored > 0) return stored;

  const regular = basePrice(product);
  const price = Number(product.price ?? 0);
  if (regular <= 0 || regular <= price) return 0;
  return Math.round(((regular - price) / regular) * 100);
}

/** The stored discount in rupees, derived when only the prices exist. */
export function discountAmount(product: DiscountLike): number {
  return (
    Number(product.discount_amount_lkr ?? 0) ||
    Math.max(0, basePrice(product) - Number(product.price ?? 0))
  );
}

/** Whether this row is actually running a promotion. */
export function hasDiscount(product: DiscountLike): boolean {
  return discountMode(product) === "fixed"
    ? discountAmount(product) > 0
    : discountPercent(product) > 0;
}

/** Everything a "% off" badge needs, in one read. */
export type DiscountSummary = {
  mode: DiscountType;
  percent: number;
  amountLkr: number;
  /** Shown to the customer, e.g. "10% OFF" or "LKR 250 OFF". */
  label: string;
  hasDiscount: boolean;
};

/**
 * The customer-facing reading of a discount.
 *
 * Both options report a percentage so the badge can always say "12% OFF" as well
 * as the stored form -- a fixed LKR 250 off LKR 2,000 is 13% off, and the shopper
 * comparing two products needs the ratio, not the rupees. The stored mode is kept
 * because "LKR 250 OFF" is the more honest label when the shop chose a fixed
 * amount.
 */
export function discountSummary(product: DiscountLike): DiscountSummary {
  const mode = discountMode(product);
  const percent = discountPercent(product);
  const amountLkr = discountAmount(product);

  return {
    mode,
    percent,
    amountLkr,
    label: mode === "fixed" ? `LKR ${Math.round(amountLkr).toLocaleString("en-LK")} OFF` : `${percent}% OFF`,
    hasDiscount: mode === "fixed" ? amountLkr > 0 : percent > 0,
  };
}
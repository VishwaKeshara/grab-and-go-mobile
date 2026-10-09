/**
 * Material Design 3 palette for Grab-and-Go.
 *
 * The brand tokens below are the single source of truth for colour. Screens
 * should reference these rather than re-declaring hex literals, because a
 * literal cannot be contrast-checked in one place.
 *
 * Every text/background pair used by the app was checked against WCAG 2.2 AA
 * (4.5:1 for body text, 3:1 for large text and UI boundaries). Two results
 * from that check shape this file:
 *
 *   - #16A34A on white is 3.30:1, so it passes only as a *fill* or as large
 *     text. It is never used for small text on white; small green text uses
 *     `accentText` (#15803D, 5.02:1).
 *   - #F59E0B on white is 2.15:1, so amber is a fill only. Small amber text
 *     uses `accentAmberText` (#92400E, 7.09:1).
 *
 * The original token names (ink, mint, paper, ...) are kept as aliases so the
 * 300-odd existing call sites keep working and the migration stays
 * visual-only.
 */
export const colors = {
  /* Brand */
  primary: "#16A34A", // 3.30:1 on white -- fills, large text, and on-dark text
  primaryDark: "#15803D", // 5.02:1 on white -- small green text, pressed states
  onPrimary: "#FFFFFF", // 3.30:1 on primary; use for >=24px text only
  accent: "#F59E0B", // 2.15:1 on white -- fills and on-dark text only
  accentSoft: "#FEF3C2", // amber container
  accentAmberText: "#92400E", // 7.09:1 on white -- small amber text
  primarySoft: "#DCFCE7", // green container
  primaryOnContainer: "#14532D", // 9.11:1 on primarySoft

  /* Text */
  ink: "#111827", // 17.74:1 on white -- main text, and the dark surface fill
  muted: "#4B5563", // 7.56:1 on white -- secondary text
  onDark: "#F9FAFB", // primary text on ink / dark surfaces
  onDarkMuted: "#D1D5DB", // 10.3:1 on ink -- secondary text on dark surfaces
  onAccent: "#111827", // 8.26:1 on accent

  /* Surfaces */
  paper: "#FFFFFF", // screen background
  white: "#FFFFFF", // cards
  surfaceAlt: "#F3F4F6", // 16.12:1 with ink -- inset / secondary surface
  night: "#111827", // dark surface (cards, splash, dark headers); 17.7:1 with white
  nightSoft: "#1F2937", // 14.7:1 with white -- raised dark surface

  /* Lines and state */
  line: "#D1D5DB", // borders and dividers
  lineStrong: "#6B7280", // 4.83:1 on white -- emphasised borders, radio outlines
  error: "#DC2626", // 4.83:1 on white -- error text and fills
  errorText: "#B91C1C", // 5.30:1 on errorSoft -- error text on its container
  errorSoft: "#FEE2E2", // error container
  success: "#15803D", // same as primaryDark, named for status rows
  warning: "#92400E", // amber-family text that must pass on light surfaces

  /* Iconography */
  iconMuted: "#6B7280", // 4.83:1 on white -- inactive icons

  /* --------------------------------------------------------------------- *
   * Legacy aliases. Values match the tokens above; kept so existing screens
   * pick up the new palette without every call site being rewritten.
   * --------------------------------------------------------------------- */
  lilac: "#F3F4F6", // was #E9E8F6 -- image placeholders and soft fills
  mint: "#16A34A", // was #55E5BA -- green fill; see accentText for green text
  mintSoft: "#DCFCE7", // was #D9FAEF -- green container
  amber: "#F59E0B", // was #F6B84B
  coral: "#DC2626", // was #EF7E69 -- destructive and error state
} as const;

/**
 * Green for *text* on light surfaces (#15803D, 5.02:1 on white).
 *
 * Separate from `colors.mint` because #16A34A fails AA as small text on
 * white. Screens that previously used `color: colors.mint` for a label need
 * this instead.
 */
export const accentText = colors.primaryDark;

/**
 * Green for text on dark surfaces (#4ADE80).
 *
 * `colors.mint` (#16A34A) reaches 5.38:1 on ink, but `accentText` (#15803D)
 * does not, so dark cards still need their own value.
 */
export const accentOnDark = "#4ADE80";
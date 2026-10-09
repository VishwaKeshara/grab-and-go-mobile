/**
 * Material Design 3 type scale for Grab-and-Go.
 *
 * Every screen pulls text styles from here so a size means the same thing
 * everywhere. Sizes are plain numbers because React Native treats `fontSize`
 * as density-independent and it still honours the OS font-scale setting.
 *
 * Weights use the MD3 names. The app previously leaned on 800/900 almost
 * everywhere, which reads as shouting at every level; the scale below reserves
 * real weight for hierarchy.
 *
 * There is no bundled Inter font in this project and adding one would mean a
 * new dependency plus a native rebuild, so `fontFamily` is intentionally left
 * unset: RN falls back to the platform default (Roboto on Android, San
 * Francisco on iOS), which is what MD3 specifies as the default typeface.
 */
export const type = {
  /* Display / screen titles */
  displayLarge: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  displayMedium: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  headlineLarge: { fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  headlineMedium: { fontSize: 22, fontWeight: "700", letterSpacing: -0.2 },

  /* Section headings */
  titleLarge: { fontSize: 20, fontWeight: "600", letterSpacing: -0.1 },
  titleMedium: { fontSize: 18, fontWeight: "600" },

  /* Product and price */
  priceLarge: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  priceMedium: { fontSize: 16, fontWeight: "700" },
  nameLarge: { fontSize: 16, fontWeight: "500", letterSpacing: 0.1 },
  nameMedium: { fontSize: 15, fontWeight: "500", letterSpacing: 0.1 },
  nameSmall: { fontSize: 14, fontWeight: "500", letterSpacing: 0.1 },

  /* Body */
  bodyLarge: { fontSize: 16, fontWeight: "400", letterSpacing: 0.15 },
  bodyMedium: { fontSize: 15, fontWeight: "400", letterSpacing: 0.25 },
  bodySmall: { fontSize: 14, fontWeight: "400", letterSpacing: 0.25 },

  /* Buttons */
  buttonLarge: { fontSize: 16, fontWeight: "600", letterSpacing: 0.1 },
  buttonMedium: { fontSize: 15, fontWeight: "600", letterSpacing: 0.1 },
  buttonSmall: { fontSize: 14, fontWeight: "600", letterSpacing: 0.1 },

  /* Inputs */
  inputLarge: { fontSize: 16, fontWeight: "400", letterSpacing: 0.15 },
  inputMedium: { fontSize: 15, fontWeight: "400", letterSpacing: 0.15 },

  /* Labels, navigation, supporting text */
  labelLarge: { fontSize: 14, fontWeight: "500", letterSpacing: 0.1 },
  labelMedium: { fontSize: 13, fontWeight: "500", letterSpacing: 0.1 },
  labelSmall: { fontSize: 12, fontWeight: "500", letterSpacing: 0.5 },
  navLabel: { fontSize: 12, fontWeight: "500", letterSpacing: 0.5 },
  overline: { fontSize: 12, fontWeight: "600", letterSpacing: 1.1 },
  caption: { fontSize: 13, fontWeight: "400", letterSpacing: 0.4 },
  captionSmall: { fontSize: 12, fontWeight: "400", letterSpacing: 0.4 },

  /* Badges and chips -- the smallest text that still clears 12sp */
  badge: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
} as const;

/**
 * MD3 weight names, for places that need to override a shared style.
 * Numeric strings because RN's TextStyle types `fontWeight` as a string union
 * that does not include MD3's 500 for every platform version.
 */
export const weight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export type TypeToken = keyof typeof type;
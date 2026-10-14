// Round Table visual language — "Still Water": light, low-saturation, blue-green
// and blush. Chosen from color-emotion research: high lightness and low saturation
// read as calm and relief; blue/white carry relief, green/pink/apricot carry only
// positive associations; brown and grey lean negative (so they are gone).
// Each advisor has a distinct accent from the same family (see config/advisors.ts).

import { useColorScheme } from "react-native";

export const palette = {
  // Light
  mist: "#F5F8F9",
  cloud: "#FFFFFF",
  tidePool: "#E9F1F3",
  shoreline: "#D9E3E7",
  slateMist: "#5E7280",
  deepWater: "#223642",
  harbor: "#3E7D91",
  harborDeep: "#2F6473",
  seaGlass: "#CFE2E8",
  blush: "#E8B3AA",
  apricot: "#F0C29B",
  sage: "#8FB59B",
  lavender: "#B7A8D4",
  aqua: "#4FB0B5",
  rose: "#B9524F",
  // Night (deep blue-slate, never black)
  night: "#121A1F",
  nightCard: "#1A242B",
  nightSoft: "#22303A",
  nightLine: "#2C3C47",
  nightText: "#E6EEF2",
  nightMuted: "#9FB2BD",
  nightHarbor: "#7FB6C6",
  nightSeaGlass: "#2B4A55",
  nightRose: "#E07B77",
};

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  cardAlt: string;
  line: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
  danger: string;
  inputBg: string;
  bubbleUser: string;
  bubbleUserText: string;
}

export const lightTheme: Theme = {
  dark: false,
  bg: palette.mist,
  card: palette.cloud,
  cardAlt: palette.tidePool,
  line: palette.shoreline,
  text: palette.deepWater,
  muted: palette.slateMist,
  primary: palette.harbor,
  primaryText: palette.cloud,
  danger: palette.rose,
  inputBg: palette.cloud,
  bubbleUser: palette.seaGlass,
  bubbleUserText: palette.deepWater,
};

export const darkTheme: Theme = {
  dark: true,
  bg: palette.night,
  card: palette.nightCard,
  cardAlt: palette.nightSoft,
  line: palette.nightLine,
  text: palette.nightText,
  muted: palette.nightMuted,
  primary: palette.nightHarbor,
  primaryText: palette.night,
  danger: palette.nightRose,
  inputBg: palette.nightCard,
  bubbleUser: palette.nightSeaGlass,
  bubbleUserText: palette.nightText,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "800" as const },
  heading: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
};

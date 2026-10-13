// Sounding Board visual language: warm neutrals, soft light, rounded shapes.
// Each advisor has a distinct accent (see config/advisors.ts).

import { useColorScheme } from "react-native";

export const palette = {
  cream: "#F6EFE6",
  linen: "#EFE5D8",
  sand: "#E3D5C3",
  clay: "#C9B9A4",
  bark: "#5B4B3E",
  ink: "#2B221B",
  ember: "#D2691E",
  emberDeep: "#B4541A",
  moss: "#6B7F5E",
  night: "#1E1A16",
  nightCard: "#2A2420",
  nightLine: "#3A332D",
  nightText: "#F2EAE0",
  nightMuted: "#B8AA9A",
  white: "#FFFFFF",
  danger: "#B5473C",
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
  bg: palette.cream,
  card: palette.white,
  cardAlt: palette.linen,
  line: palette.sand,
  text: palette.ink,
  muted: palette.bark,
  primary: palette.ember,
  primaryText: palette.white,
  danger: palette.danger,
  inputBg: palette.white,
  bubbleUser: palette.ember,
  bubbleUserText: palette.white,
};

export const darkTheme: Theme = {
  dark: true,
  bg: palette.night,
  card: palette.nightCard,
  cardAlt: "#332C26",
  line: palette.nightLine,
  text: palette.nightText,
  muted: palette.nightMuted,
  primary: palette.ember,
  primaryText: palette.white,
  danger: "#E0695C",
  inputBg: palette.nightCard,
  bubbleUser: palette.emberDeep,
  bubbleUserText: palette.white,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: "700" as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700" as const },
  heading: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 23 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
};

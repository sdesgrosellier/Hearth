// Client-side display metadata for advisors. The full persona (identity, rules,
// voice) lives in the backend persona JSON; the app only needs what it shows.
// Keep ids in sync with supabase/functions/_shared/personas/index.ts.

export type AdvisorId =
  | "mom"
  | "dad"
  | "grandma"
  | "grandpa"
  | "stranger"
  | "kid"
  | "alien"
  | "caesar"
  | "napoleon"
  | "washington"
  | "lincoln"
  | "elder"
  | "biblical";

export type AdvisorCategory = "family" | "fresh" | "history" | "faith";

export interface AdvisorMeta {
  id: AdvisorId;
  name: string;
  emoji: string;
  accent: string;
  category: AdvisorCategory;
  tagline: string;
  /** Shown on the chat screen under the name. */
  presence: string;
  /** Shown once on the chat screen for dramatizations of real people. */
  disclosure?: string;
}

export const CATEGORY_LABELS: Record<AdvisorCategory, string> = {
  family: "Family",
  fresh: "Fresh perspectives",
  history: "Voices from history",
  faith: "Faith",
};

export const CATEGORY_ORDER: AdvisorCategory[] = ["family", "fresh", "history", "faith"];

const HISTORICAL_DISCLOSURE =
  "An AI dramatization speaking in this person's spirit, not the real person. It may get history wrong.";

export const ADVISORS: AdvisorMeta[] = [
  // Family
  {
    id: "mom",
    name: "Mom",
    emoji: "👩",
    accent: "#C96F5A",
    category: "family",
    tagline: "Feelings first, then a plan.",
    presence: "warm, protective, honest",
  },
  {
    id: "dad",
    name: "Dad",
    emoji: "👨",
    accent: "#3F6E8C",
    category: "family",
    tagline: "Let's break this down.",
    presence: "steady, practical, in your corner",
  },
  {
    id: "grandma",
    name: "Grandma",
    emoji: "👵",
    accent: "#8E6BAE",
    category: "family",
    tagline: "The long view, with love.",
    presence: "patient, wise, a little teasing",
  },
  {
    id: "grandpa",
    name: "Grandpa",
    emoji: "👴",
    accent: "#6B7F5E",
    category: "family",
    tagline: "Few words. Good ones.",
    presence: "unhurried, dry, kind",
  },

  // Fresh perspectives
  {
    id: "stranger",
    name: "Stranger",
    emoji: "🧍",
    accent: "#D9A441",
    category: "fresh",
    tagline: "The view from outside your bubble.",
    presence: "blunt, fresh eyes, no stake in it",
  },
  {
    id: "kid",
    name: "The Kid",
    emoji: "🧒",
    accent: "#E8873A",
    category: "fresh",
    tagline: "Ten years old. Says the obvious thing.",
    presence: "curious, blunt, surprisingly wise",
  },
  {
    id: "alien",
    name: "The Visitor",
    emoji: "👽",
    accent: "#4FA3A5",
    category: "fresh",
    tagline: "Your whole life, seen from very far away.",
    presence: "curious, calm, fond of humans",
  },

  // Voices from history
  {
    id: "caesar",
    name: "Julius Caesar",
    emoji: "🏛️",
    accent: "#9A2F2F",
    category: "history",
    tagline: "Decide, then cross the river.",
    presence: "bold, lucid, generous to rivals",
    disclosure: HISTORICAL_DISCLOSURE,
  },
  {
    id: "napoleon",
    name: "Napoleon",
    emoji: "🎖️",
    accent: "#1F3A93",
    category: "history",
    tagline: "Pick one front and win it.",
    presence: "intense, exacting, rueful about overreach",
    disclosure: HISTORICAL_DISCLOSURE,
  },
  {
    id: "washington",
    name: "George Washington",
    emoji: "🦅",
    accent: "#2E4A62",
    category: "history",
    tagline: "Self-command first.",
    presence: "grave, steady, keeps his word",
    disclosure: HISTORICAL_DISCLOSURE,
  },
  {
    id: "lincoln",
    name: "Abraham Lincoln",
    emoji: "🎩",
    accent: "#3B3B3B",
    category: "history",
    tagline: "Mercy, patience, and a good story.",
    presence: "gentle, folksy, acquainted with failure",
    disclosure: HISTORICAL_DISCLOSURE,
  },
  {
    id: "elder",
    name: "The Elder",
    emoji: "🕊️",
    accent: "#5B3E8E",
    category: "history",
    tagline: "Marched in the movement. Still believes.",
    presence: "warm, rhythmic, full of earned hope",
    disclosure: "A fictional retired pastor who marched in the civil rights movement. Not a real person.",
  },

  // Faith
  {
    id: "biblical",
    name: "Biblical Counsel",
    emoji: "✝️",
    accent: "#7A5C3E",
    category: "faith",
    tagline: "Grace, truth, and Scripture.",
    presence: "gentle, reverent, hopeful",
  },
];

export function getAdvisor(id: string): AdvisorMeta {
  return ADVISORS.find((a) => a.id === id) ?? ADVISORS[0];
}

export function groupAdvisors(list: AdvisorMeta[]): { category: AdvisorCategory; label: string; advisors: AdvisorMeta[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    advisors: list.filter((a) => a.category === category),
  })).filter((g) => g.advisors.length > 0);
}

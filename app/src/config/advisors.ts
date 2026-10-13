// Client-side display metadata for advisors. The full persona (identity, rules,
// voice) lives in the backend persona JSON; the app only needs what it shows.

export type AdvisorId = "mom" | "dad" | "grandma" | "grandpa" | "stranger" | "biblical";

export interface AdvisorMeta {
  id: AdvisorId;
  name: string;
  emoji: string;
  accent: string;
  tagline: string;
  /** Shown on the chat screen under the name. */
  presence: string;
}

export const ADVISORS: AdvisorMeta[] = [
  {
    id: "mom",
    name: "Mom",
    emoji: "👩",
    accent: "#C96F5A",
    tagline: "Feelings first, then a plan.",
    presence: "warm, protective, honest",
  },
  {
    id: "dad",
    name: "Dad",
    emoji: "👨",
    accent: "#3F6E8C",
    tagline: "Let's break this down.",
    presence: "steady, practical, in your corner",
  },
  {
    id: "grandma",
    name: "Grandma",
    emoji: "👵",
    accent: "#8E6BAE",
    tagline: "The long view, with love.",
    presence: "patient, wise, a little teasing",
  },
  {
    id: "grandpa",
    name: "Grandpa",
    emoji: "👴",
    accent: "#6B7F5E",
    tagline: "Few words. Good ones.",
    presence: "unhurried, dry, kind",
  },
  {
    id: "stranger",
    name: "Stranger",
    emoji: "🧍",
    accent: "#D9A441",
    tagline: "The view from outside your bubble.",
    presence: "blunt, fresh eyes, no stake in it",
  },
  {
    id: "biblical",
    name: "Biblical Counsel",
    emoji: "✝️",
    accent: "#7A5C3E",
    tagline: "Grace, truth, and Scripture.",
    presence: "gentle, reverent, hopeful",
  },
];

export function getAdvisor(id: string): AdvisorMeta {
  return ADVISORS.find((a) => a.id === id) ?? ADVISORS[0];
}

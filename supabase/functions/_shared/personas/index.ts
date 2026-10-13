// Persona registry. Personas are data (JSON), loaded here so the rest of the
// backend never hard-codes a character. Add a new advisor by adding a JSON file
// and one line below (and a matching entry in app/src/config/advisors.ts).

import type { PersonaConfig, StrangerArchetype } from "../types.ts";

import mom from "./mom.json" with { type: "json" };
import dad from "./dad.json" with { type: "json" };
import grandma from "./grandma.json" with { type: "json" };
import grandpa from "./grandpa.json" with { type: "json" };
import stranger from "./stranger.json" with { type: "json" };
import biblical from "./biblical.json" with { type: "json" };
import kid from "./kid.json" with { type: "json" };
import alien from "./alien.json" with { type: "json" };
import caesar from "./caesar.json" with { type: "json" };
import napoleon from "./napoleon.json" with { type: "json" };
import washington from "./washington.json" with { type: "json" };
import lincoln from "./lincoln.json" with { type: "json" };
import elder from "./elder.json" with { type: "json" };
import strangerArchetypesFile from "./stranger-archetypes.json" with { type: "json" };

const REGISTRY: Record<string, PersonaConfig> = {
  // Family
  mom: mom as PersonaConfig,
  dad: dad as PersonaConfig,
  grandma: grandma as PersonaConfig,
  grandpa: grandpa as PersonaConfig,
  // Fresh perspectives
  stranger: stranger as PersonaConfig,
  kid: kid as PersonaConfig,
  alien: alien as PersonaConfig,
  // Voices from history
  caesar: caesar as PersonaConfig,
  napoleon: napoleon as PersonaConfig,
  washington: washington as PersonaConfig,
  lincoln: lincoln as PersonaConfig,
  elder: elder as PersonaConfig,
  // Faith
  biblical: biblical as PersonaConfig,
};

export const PERSONA_VERSION = 2;

export function getPersona(id: string): PersonaConfig | null {
  return REGISTRY[id] ?? null;
}

export function listPersonas(): PersonaConfig[] {
  return Object.values(REGISTRY);
}

export const STRANGER_ARCHETYPES: StrangerArchetype[] =
  (strangerArchetypesFile as { archetypes: StrangerArchetype[] }).archetypes;

export function pickStrangerArchetype(excludeId?: string): StrangerArchetype {
  const pool = STRANGER_ARCHETYPES.filter((a) => a.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getStrangerArchetype(id: string): StrangerArchetype | null {
  return STRANGER_ARCHETYPES.find((a) => a.id === id) ?? null;
}

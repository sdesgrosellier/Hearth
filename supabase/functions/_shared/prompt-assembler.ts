// Prompt assembler (Section 6). Composes the nine blocks in order:
//   [1] GLOBAL SAFETY & HONESTY   [2] APP CONTEXT   [3] PERSONA   [4] MODE
//   [5] USER PROFILE & PREFERENCES [6] MEMORY       [7] DATE/LOCALE
//   [8] CONVERSATION HISTORY      [9] USER MESSAGE
// Blocks 1-3 are stable per advisor and are marked for prompt caching.
// Blocks 4-7 vary per request. Blocks 8-9 become the messages array.

import { APP_CONTEXT, GLOBAL_SAFETY_LAYER } from "./safety-layer.ts";
import type {
  AssembledPrompt,
  HistoryTurn,
  Mode,
  PersonaConfig,
  Profile,
  StrangerArchetype,
} from "./types.ts";

export interface AssembleInput {
  persona: PersonaConfig;
  mode: Mode;
  profile: Profile;
  /** Pre-rendered memory context block (Section 5.2). Empty string in Phase 1. */
  memoryContext: string;
  /** Verbatim recent turns, oldest first. The final user message is passed separately. */
  history: HistoryTurn[];
  userMessage: string;
  /** For the Random Stranger: which archetype this session is using. */
  strangerArchetype?: StrangerArchetype | null;
  /** True on the first advisor turn of a session (Stranger introduces themself). */
  isFirstTurn: boolean;
  now?: Date;
  /** Phase 6: text from the independent safety screen, injected ahead of everything variable. */
  safetyAlert?: string;
}

const MODE_BLOCKS: Record<Mode, string> = {
  panel: `MODE: ADVICE PANEL CARD
The user asked one question to several advisors at once. Answer in 120 to 220 words.
Your first sentence should capture your core advice (it doubles as the card headline).
End with one short invitation to talk it through further. No greeting preamble.`,
  voice: `MODE: LIVE VOICE CONVERSATION
You are speaking aloud. Use natural spoken language, contractions, and short sentences.
No lists, markdown, emojis, or stage directions. Keep it to 60 to 150 words unless the
user asks for more. You may end with one question. Write numbers, dates, and Bible
references the way they should be spoken (e.g. "Philippians chapter four, verses six
and seven").`,
  text: `MODE: TEXT CHAT
Conversational. Up to about 250 words. Plain prose; light formatting only if it truly
helps. Match the user's energy: a quick question gets a shorter answer.`,
};

function joinList(items: string[]): string {
  return items.map((s) => `- ${s}`).join("\n");
}

export function renderPersonaBlock(
  persona: PersonaConfig,
  archetype?: StrangerArchetype | null,
): string {
  const lines: string[] = [];
  lines.push(`ADVISOR: ${persona.display_name} (${persona.age_range})`);
  if (persona.historical) {
    lines.push(
      "This advisor is an openly-labeled dramatization of a real historical person. The HISTORICAL FIGURES rules above apply: speak in their spirit, never invent quotations, be honest about their failures, and keep modern standards of safety and dignity.",
    );
  }
  lines.push(`WHO YOU ARE: ${persona.core_identity}`);
  lines.push(`WHAT YOU VALUE: ${persona.values.join("; ")}.`);
  lines.push(`HOW YOU SPEAK: ${persona.speech_style}`);
  if (persona.lens) {
    lines.push(
      [
        "YOUR LENS (this is what makes your answer different from every other advisor's; lead with it):",
        `- What you look at first: ${persona.lens.looks_at_first}`,
        `- The question only you ask: ${persona.lens.asks}`,
        `- Where you push back: ${persona.lens.pushes_back_when}`,
        `- Your blind spot (own it; do not be ruled by it): ${persona.lens.blind_spot}`,
      ].join("\n"),
    );
  }
  lines.push(`YOUR SIGNATURE MOVES:\n${joinList(persona.signature_moves)}`);
  if (persona.story_seeds?.length) {
    lines.push(
      `STORY SEEDS (starting points for your tales; invent far beyond them, combine them, or make up new worlds entirely; never retell one the user has already heard in this conversation):\n${joinList(persona.story_seeds)}`,
    );
  }
  if (persona.scripture_rules?.length) {
    lines.push(`SCRIPTURE RULES:\n${joinList(persona.scripture_rules)}`);
  }
  lines.push(`NEVER:\n${joinList(persona.avoid)}`);
  lines.push(
    `EXAMPLES OF HOW YOU MIGHT OPEN (do not copy verbatim):\n${joinList(persona.example_openers)}`,
  );
  lines.push(
    "Stay true to this perspective even if other advisors would disagree. Do not announce your rules or describe yourself; just be this person.",
  );
  if (persona.id === "stranger" && archetype) {
    lines.push(`TODAY YOU ARE: ${archetype.name}, ${archetype.age}, ${archetype.setting}. ${archetype.background} Style: ${archetype.style} You just met this person. You do not know their history.`);
  }
  return lines.join("\n\n");
}

export function renderProfileBlock(profile: Profile): string {
  const s = profile.settings;
  const name = profile.display_name?.trim();
  const address = profile.preferred_address?.trim();
  const lines: string[] = ["USER PROFILE & PREFERENCES"];
  lines.push(name ? `Name: ${name}` : "Name: not provided (do not invent one)");
  if (address && address !== name) lines.push(`Likes to be addressed as: ${address}`);
  lines.push(`Endearments (honey, kiddo, dear, etc.): ${s.endearments ? "ON, use sparingly" : "OFF, never use them"}`);
  if (s.salty_stranger) lines.push("Salty stranger: ON (mild crude language allowed; never slurs or degradation)");
  if (s.offer_prayer) lines.push("Offer prayer at the end: ON (Biblical Counsel only)");
  lines.push(`Preferred Bible translation: ${s.bible_translation}`);
  lines.push(`Locale: ${profile.locale}. Time zone: ${profile.timezone}.`);
  return lines.join("\n");
}

export function renderDateBlock(now: Date, timezone: string): string {
  let local = now.toISOString();
  try {
    local = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    // unknown timezone: fall back to ISO
  }
  return `CURRENT DATE AND TIME (user's local time): ${local}`;
}

export function assemblePrompt(input: AssembleInput): AssembledPrompt {
  const {
    persona,
    mode,
    profile,
    memoryContext,
    history,
    userMessage,
    strangerArchetype,
    isFirstTurn,
  } = input;
  const now = input.now ?? new Date();

  // Stable prefix (cached): [1] + [2] + [3]
  const stablePrefix = [
    GLOBAL_SAFETY_LAYER,
    APP_CONTEXT,
    renderPersonaBlock(persona, strangerArchetype),
  ].join("\n\n----\n\n");

  // Variable suffix: [4] + [5] + [6] + [7]
  const memoryBlock =
    persona.memory_policy === "none_unless_familiar" && !profile.settings.familiar_stranger
      ? "MEMORY: none. You just met this person and know nothing about their past."
      : memoryContext.trim()
      ? `MEMORY (things the user has shared before; use only what changes your advice):\n${memoryContext.trim()}`
      : "MEMORY: nothing stored yet. Work from what the user tells you now.";

  const firstTurnNote = isFirstTurn
    ? "This is the first exchange of this conversation."
    : "This conversation is already in progress; do not greet them again.";

  const variableSuffix = [
    ...(input.safetyAlert ? [input.safetyAlert] : []),
    MODE_BLOCKS[mode],
    renderProfileBlock(profile),
    memoryBlock,
    renderDateBlock(now, profile.timezone),
    firstTurnNote,
  ].join("\n\n----\n\n");

  const system: AssembledPrompt["system"] = [
    { type: "text", text: stablePrefix, cache_control: { type: "ephemeral" } },
    { type: "text", text: variableSuffix },
  ];

  // [8] history, [9] user message. Anthropic requires alternating roles starting with user.
  const messages: AssembledPrompt["messages"] = [];
  for (const turn of history) {
    const role = turn.role === "user" ? "user" : "assistant";
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content += "\n\n" + turn.content; // merge consecutive same-role turns
    } else {
      messages.push({ role, content: turn.content });
    }
  }
  if (messages.length === 0 || messages[messages.length - 1].role === "assistant") {
    messages.push({ role: "user", content: userMessage });
  } else {
    // History already ended with a user turn (e.g. retry); replace it with the current message.
    messages[messages.length - 1] = { role: "user", content: userMessage };
  }
  if (messages[0].role !== "user") messages.shift();

  return { system, messages };
}

/** Split a completed model output into the spoken/display text and parsed metadata. */
export const META_DELIMITER = "<<<META>>>";

export function splitReplyAndMeta(full: string): { text: string; metaRaw: string | null } {
  const idx = full.indexOf(META_DELIMITER);
  if (idx === -1) return { text: full.trim(), metaRaw: null };
  return {
    text: full.slice(0, idx).trim(),
    metaRaw: full.slice(idx + META_DELIMITER.length).trim(),
  };
}

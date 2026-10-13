// Phase 3 — long-term memory.
//
// Before a reply:  retrieveMemory() builds the MEMORY block from the user's stored
//                  facts (semantic + recent), recent conversation summaries, and any
//                  pending follow-ups.
// After a reply:   updateMemoryAfterTurn() asks the fast model to extract new facts
//                  the USER stated, refresh the session summary, and optionally queue
//                  one follow-up. Facts are embedded with the Edge Runtime's built-in
//                  gte-small model (384 dims, English) and de-duplicated by similarity.
//
// Safety: nothing is stored for crisis turns, off-record sessions, or when the user
// has memory off; the extractor is told to skip minors' ages, self-harm, abuse,
// crimes, and identification numbers.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { DEFAULT_FAST_MODEL, streamMessage } from "./anthropic.ts";
import { getPersona } from "./personas/index.ts";
import type { HistoryTurn, Profile } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

const EMBED_DIMS = 384;
const SEMANTIC_LIMIT = 8;
const RECENT_FACT_LIMIT = 6;
const SUMMARY_LIMIT = 3;
const FOLLOWUP_LIMIT = 2;
const DUPLICATE_SIMILARITY = 0.9;

export const MEMORY_CATEGORIES = [
  "people",
  "ongoing_situations",
  "goals_and_values",
  "preferences",
  "upcoming_events",
  "outcomes",
] as const;
type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

interface FactRow {
  id: string;
  category: MemoryCategory;
  content: string;
  event_date: string | null;
  status: "open" | "resolved" | "archived";
  created_at: string;
  similarity?: number;
}

// ---------------------------------------------------------------------------
// Embeddings (built into the Supabase Edge Runtime; no key, no network)
// ---------------------------------------------------------------------------

let embedSession: { run: (input: string, opts: Record<string, unknown>) => Promise<unknown> } | null = null;

export async function embed(text: string): Promise<number[] | null> {
  try {
    if (!embedSession) {
      const ai = (globalThis as { Supabase?: { ai?: { Session: new (model: string) => typeof embedSession } } })
        .Supabase?.ai;
      if (!ai) return null;
      embedSession = new ai.Session("gte-small");
    }
    const out = await embedSession!.run(text.slice(0, 2000), { mean_pool: true, normalize: true });
    const arr = Array.from(out as ArrayLike<number>);
    return arr.length === EMBED_DIMS ? arr : null;
  } catch (err) {
    console.warn("embed failed", (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null | undefined, timezone: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  people: "people in their life",
  ongoing_situations: "ongoing situations",
  goals_and_values: "goals and values",
  preferences: "preferences",
  upcoming_events: "upcoming events",
  outcomes: "how things turned out",
};

export interface RetrievedMemory {
  context: string;
  followupIds: string[];
}

/**
 * Builds the MEMORY block for the prompt. Returns an empty context when the user
 * has memory off or nothing is stored yet.
 */
export async function retrieveMemory(
  admin: Admin,
  profile: Profile,
  currentSessionId: string,
  query: string,
  advisorId: string,
): Promise<RetrievedMemory> {
  if (!profile.settings.memory_enabled) return { context: "", followupIds: [] };
  const userId = profile.id;
  const tz = profile.timezone || "UTC";

  // Facts: semantic matches for this question + the most recent ones.
  const byId = new Map<string, FactRow>();
  const vector = await embed(query);
  if (vector) {
    const { data } = await admin.rpc("match_memory_facts", {
      p_user_id: userId,
      p_query: vector,
      p_limit: SEMANTIC_LIMIT,
      p_min_similarity: 0.25,
    });
    for (const f of (data ?? []) as FactRow[]) byId.set(f.id, f);
  }
  const { data: recent } = await admin
    .from("memory_facts")
    .select("id, category, content, event_date, status, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(RECENT_FACT_LIMIT);
  for (const f of (recent ?? []) as FactRow[]) if (!byId.has(f.id)) byId.set(f.id, f);

  // Recent conversations (not this one).
  const { data: sessions } = await admin
    .from("sessions")
    .select("id, started_at, advisor_ids, summary")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("id", currentSessionId)
    .not("summary", "is", null)
    .order("started_at", { ascending: false })
    .limit(SUMMARY_LIMIT);

  // Pending follow-ups (any advisor may raise them; the one named is preferred).
  const { data: followups } = await admin
    .from("followups")
    .select("id, question, advisor_id, due_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(FOLLOWUP_LIMIT);

  const facts = Array.from(byId.values());
  const lines: string[] = [];

  if (facts.length) {
    lines.push("THINGS THE USER HAS SHARED BEFORE (their own words, condensed; use only what changes your advice):");
    const grouped = new Map<MemoryCategory, FactRow[]>();
    for (const f of facts) grouped.set(f.category, [...(grouped.get(f.category) ?? []), f]);
    for (const [cat, rows] of grouped) {
      lines.push(`- ${CATEGORY_LABEL[cat] ?? cat}:`);
      for (const f of rows) {
        const when = f.event_date ? ` (${f.event_date})` : ` (shared ${fmtDate(f.created_at, tz)})`;
        const resolved = f.status === "resolved" ? " [resolved]" : "";
        lines.push(`    • ${f.content}${when}${resolved}`);
      }
    }
  }

  if (sessions?.length) {
    lines.push("", "RECENT CONVERSATIONS (most recent first):");
    for (const s of sessions) {
      const who = ((s.advisor_ids as string[]) ?? []).map((id) => getPersona(id)?.display_name ?? id).join(", ");
      lines.push(`- ${fmtDate(s.started_at as string, tz)} with ${who || "an advisor"}: ${s.summary}`);
    }
  }

  const followupIds: string[] = [];
  if (followups?.length) {
    lines.push("", "OPEN FOLLOW-UPS (ask about one of these naturally, early in the conversation, if it fits; do not interrogate):");
    for (const f of followups) {
      const who = f.advisor_id ? getPersona(f.advisor_id as string)?.display_name ?? "" : "";
      const mine = f.advisor_id === advisorId ? " (you asked them to report back)" : who ? ` (${who} asked about this)` : "";
      lines.push(`- ${f.question}${mine}`);
      followupIds.push(f.id as string);
    }
  }

  return { context: lines.join("\n"), followupIds };
}

// ---------------------------------------------------------------------------
// Extraction after a turn
// ---------------------------------------------------------------------------

const EXTRACTOR_SYSTEM = `
You maintain the long-term memory of a personal-advice app. After each exchange you are
given the recent conversation, the user's newest message, the advisor's reply, and the
facts already stored. Return ONLY a JSON object, no prose, with this shape:

{"summary": "<2-3 sentences: what the user brought, what the advisor(s) suggested, where it landed; written in third person, past tense, no advice of your own>",
 "new_facts": [{"category": "people|ongoing_situations|goals_and_values|preferences|upcoming_events|outcomes",
                "content": "<one short sentence in the user's own terms, e.g. 'has a brother, estranged for two years after a fight about their dad's house'>",
                "event_date": "YYYY-MM-DD or null"}],
 "resolved_fact_ids": ["<id of a stored fact that the user now says is over or changed>"],
 "followup": {"question": "<a natural check-in question for next time, e.g. 'How did the conversation with your brother go?'>",
              "due_in_days": 3} }

Rules:
- new_facts contains ONLY things the USER stated about their own life in their newest
  message (not earlier messages, which were already processed; not the advisor's guesses,
  advice, or hypotheticals). Zero facts is a normal answer.
- Never store: anyone's age under 18 or that someone is a minor, self-harm or suicidal
  thoughts, abuse details, crimes, sexual activity, immigration status, medical diagnoses
  the user did not state plainly, or any identification, card, or account number.
- Do not duplicate or restate a fact already in the stored list; if the user updated one,
  add the new version and put the old id in resolved_fact_ids.
- Keep content compact and durable (prefer "is job-hunting" over "sent three résumés today").
- followup is null unless the user described something with a clear next moment (a talk
  they plan to have, a decision due, an event). At most one.
- summary is required every time and should fold in the whole conversation so far.
`.trim();

interface ExtractorOutput {
  summary?: string;
  new_facts?: { category?: string; content?: string; event_date?: string | null }[];
  resolved_fact_ids?: string[];
  followup?: { question?: string; due_in_days?: number } | null;
}

function parseJson(raw: string): ExtractorOutput | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as ExtractorOutput;
  } catch {
    return null;
  }
}

export interface MemoryUpdateInput {
  profile: Profile;
  sessionId: string;
  advisorId: string;
  history: HistoryTurn[]; // before the new message
  userMessage: string;
  advisorReply: string;
  safetyFlag: "none" | "elevated" | "crisis";
  offRecord: boolean;
  askedFollowupIds: string[];
}

export async function updateMemoryAfterTurn(admin: Admin, input: MemoryUpdateInput): Promise<void> {
  const { profile, sessionId, advisorId, history, userMessage, advisorReply, safetyFlag, offRecord } = input;
  if (!profile.settings.memory_enabled || offRecord || safetyFlag === "crisis") return;
  const userId = profile.id;

  // Mark follow-ups that were surfaced this turn so they are not asked again.
  if (input.askedFollowupIds.length) {
    await admin
      .from("followups")
      .update({ status: "asked", asked_at: new Date().toISOString() })
      .in("id", input.askedFollowupIds);
  }

  // Facts edited in My Story lose their embedding; refresh a few each turn.
  const { data: unembedded } = await admin
    .from("memory_facts")
    .select("id, content")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("embedding", null)
    .limit(5);
  for (const f of unembedded ?? []) {
    const vec = await embed(f.content as string);
    if (vec) await admin.from("memory_facts").update({ embedding: vec }).eq("id", f.id);
  }

  const { data: stored } = await admin
    .from("memory_facts")
    .select("id, category, content, status")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(40);

  const advisorName = getPersona(advisorId)?.display_name ?? advisorId;
  const recent = history.slice(-8).map((t) =>
    t.role === "user" ? `USER: ${t.content}` : `${getPersona(t.advisor_id ?? "")?.display_name ?? "ADVISOR"}: ${t.content}`
  );
  const transcript = [
    "RECENT CONVERSATION (already processed; context only):",
    recent.length ? recent.join("\n") : "(none)",
    "",
    `USER'S NEWEST MESSAGE:\n${userMessage}`,
    "",
    `${advisorName.toUpperCase()} REPLIED:\n${advisorReply}`,
    "",
    "STORED FACTS (id | category | content):",
    (stored ?? []).length
      ? (stored ?? []).map((f) => `${f.id} | ${f.category} | ${f.content}${f.status === "resolved" ? " [resolved]" : ""}`).join("\n")
      : "(none yet)",
    "",
    `Today is ${new Date().toISOString().slice(0, 10)}. Return the JSON now.`,
  ].join("\n");

  let raw = "";
  try {
    const result = await streamMessage(
      {
        system: [{ type: "text", text: EXTRACTOR_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: transcript }],
      },
      () => {},
      { model: DEFAULT_FAST_MODEL, max_tokens: 900, thinking: "disabled" },
    );
    raw = result.text;
    await admin.rpc("increment_usage", {
      p_user_id: userId,
      p_llm_input: result.usage.input_tokens + result.usage.cache_read_input_tokens + result.usage.cache_creation_input_tokens,
      p_llm_output: result.usage.output_tokens,
      p_tts_chars: 0,
      p_stt_seconds: 0,
    });
  } catch (err) {
    console.error("memory extraction failed", (err as Error).message);
    return;
  }

  const out = parseJson(raw);
  if (!out) {
    console.warn("memory extractor returned non-JSON");
    return;
  }

  // Session summary (+ embedding for future semantic recall of conversations).
  if (out.summary && out.summary.trim()) {
    const summary = out.summary.trim().slice(0, 1200);
    const vec = await embed(summary);
    await admin
      .from("sessions")
      .update({ summary, ...(vec ? { summary_embedding: vec } : {}) })
      .eq("id", sessionId);
  }

  // Resolved facts.
  const storedIds = new Set((stored ?? []).map((f) => f.id as string));
  const resolved = (out.resolved_fact_ids ?? []).filter((id) => storedIds.has(id));
  if (resolved.length) {
    await admin.from("memory_facts").update({ status: "resolved" }).in("id", resolved);
  }

  // New facts, de-duplicated by embedding similarity.
  for (const f of (out.new_facts ?? []).slice(0, 6)) {
    const content = (f.content ?? "").trim();
    const category = (MEMORY_CATEGORIES as readonly string[]).includes(f.category ?? "")
      ? (f.category as MemoryCategory)
      : "ongoing_situations";
    if (content.length < 6 || content.length > 300) continue;
    const vec = await embed(content);
    if (vec) {
      const { data: near } = await admin.rpc("match_memory_facts", {
        p_user_id: userId,
        p_query: vec,
        p_limit: 1,
        p_min_similarity: DUPLICATE_SIMILARITY,
      });
      if ((near ?? []).length) continue; // already known
    }
    const eventDate = f.event_date && /^\d{4}-\d{2}-\d{2}$/.test(f.event_date) ? f.event_date : null;
    await admin.from("memory_facts").insert({
      user_id: userId,
      category,
      content,
      source_session_id: sessionId,
      stated_by_user: true,
      confidence: 0.9,
      event_date: eventDate,
      ...(vec ? { embedding: vec } : {}),
    });
  }

  // One follow-up per session at most.
  const q = out.followup?.question?.trim();
  if (q && q.length > 8 && q.length < 240) {
    const { data: existing } = await admin
      .from("followups")
      .select("id")
      .eq("user_id", userId)
      .eq("source_session_id", sessionId)
      .in("status", ["pending", "asked"])
      .limit(1);
    if (!(existing ?? []).length) {
      const days = Math.min(Math.max(Number(out.followup?.due_in_days ?? 3) || 3, 1), 30);
      await admin.from("followups").insert({
        user_id: userId,
        question: q,
        advisor_id: advisorId,
        source_session_id: sessionId,
        due_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      });
    }
  }
}

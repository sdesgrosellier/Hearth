// Phase 5 — Scripture verification. Every reference an advisor lists in
// scripture_refs is parsed, normalized, and looked up in bible_verses (World
// English Bible, public domain). Verified passages carry the real verse text so
// the app shows it under the reply; anything that can't be found is marked
// unverified and never shown as Scripture.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

export interface VerifiedRef {
  ref: string; // normalized, e.g. "Psalms 46:1-2"
  translation: string;
  verified: boolean;
  text?: string;
  book?: string;
  chapter?: number;
  verses?: number[];
}

const MAX_REFS = 6;
const MAX_VERSES_PER_REF = 10;

// Canonical book names (as stored) and the abbreviations people and models use.
const BOOKS: [string, string[]][] = [
  ["Genesis", ["gen", "ge", "gn"]],
  ["Exodus", ["exod", "exo", "ex"]],
  ["Leviticus", ["lev", "le", "lv"]],
  ["Numbers", ["num", "nu", "nm", "nb"]],
  ["Deuteronomy", ["deut", "deu", "dt"]],
  ["Joshua", ["josh", "jos", "jsh"]],
  ["Judges", ["judg", "jdg", "jg", "jdgs"]],
  ["Ruth", ["rth", "ru"]],
  ["1 Samuel", ["1sam", "1sa", "1sm", "1s", "isamuel", "firstsamuel"]],
  ["2 Samuel", ["2sam", "2sa", "2sm", "2s", "iisamuel", "secondsamuel"]],
  ["1 Kings", ["1kgs", "1ki", "1k", "ikings", "firstkings"]],
  ["2 Kings", ["2kgs", "2ki", "2k", "iikings", "secondkings"]],
  ["1 Chronicles", ["1chr", "1ch", "1chron", "ichronicles", "firstchronicles"]],
  ["2 Chronicles", ["2chr", "2ch", "2chron", "iichronicles", "secondchronicles"]],
  ["Ezra", ["ezr"]],
  ["Nehemiah", ["neh", "ne"]],
  ["Esther", ["esth", "est", "es"]],
  ["Job", ["jb"]],
  ["Psalms", ["psalm", "ps", "psa", "pss", "psm", "pslm"]],
  ["Proverbs", ["prov", "pro", "pr", "prv"]],
  ["Ecclesiastes", ["eccl", "eccles", "ecc", "ec", "qoh", "qoheleth"]],
  ["Song of Solomon", ["song", "songofsongs", "sos", "so", "canticles", "cant", "songs"]],
  ["Isaiah", ["isa", "is"]],
  ["Jeremiah", ["jer", "je", "jr"]],
  ["Lamentations", ["lam", "la"]],
  ["Ezekiel", ["ezek", "eze", "ezk"]],
  ["Daniel", ["dan", "da", "dn"]],
  ["Hosea", ["hos", "ho"]],
  ["Joel", ["jl"]],
  ["Amos", ["am"]],
  ["Obadiah", ["obad", "ob"]],
  ["Jonah", ["jon", "jnh"]],
  ["Micah", ["mic", "mc"]],
  ["Nahum", ["nah", "na"]],
  ["Habakkuk", ["hab", "hb"]],
  ["Zephaniah", ["zeph", "zep", "zp"]],
  ["Haggai", ["hag", "hg"]],
  ["Zechariah", ["zech", "zec", "zc"]],
  ["Malachi", ["mal", "ml"]],
  ["Matthew", ["matt", "mat", "mt"]],
  ["Mark", ["mrk", "mk", "mr"]],
  ["Luke", ["luk", "lk"]],
  ["John", ["jhn", "jn"]],
  ["Acts", ["act", "ac"]],
  ["Romans", ["rom", "ro", "rm"]],
  ["1 Corinthians", ["1cor", "1co", "icorinthians", "firstcorinthians"]],
  ["2 Corinthians", ["2cor", "2co", "iicorinthians", "secondcorinthians"]],
  ["Galatians", ["gal", "ga"]],
  ["Ephesians", ["eph", "ephes"]],
  ["Philippians", ["phil", "php", "pp"]],
  ["Colossians", ["col", "co"]],
  ["1 Thessalonians", ["1thess", "1thes", "1th", "ithessalonians", "firstthessalonians"]],
  ["2 Thessalonians", ["2thess", "2thes", "2th", "iithessalonians", "secondthessalonians"]],
  ["1 Timothy", ["1tim", "1ti", "itimothy", "firsttimothy"]],
  ["2 Timothy", ["2tim", "2ti", "iitimothy", "secondtimothy"]],
  ["Titus", ["tit", "ti"]],
  ["Philemon", ["phlm", "philem", "phm", "pm"]],
  ["Hebrews", ["heb"]],
  ["James", ["jas", "jm"]],
  ["1 Peter", ["1pet", "1pe", "1pt", "1p", "ipeter", "firstpeter"]],
  ["2 Peter", ["2pet", "2pe", "2pt", "2p", "iipeter", "secondpeter"]],
  ["1 John", ["1jn", "1jhn", "1jo", "1j", "ijohn", "firstjohn"]],
  ["2 John", ["2jn", "2jhn", "2jo", "2j", "iijohn", "secondjohn"]],
  ["3 John", ["3jn", "3jhn", "3jo", "3j", "iiijohn", "thirdjohn"]],
  ["Jude", ["jud", "jd"]],
  ["Revelation", ["rev", "re", "revelations", "apocalypse"]],
];

const BOOK_INDEX = new Map<string, string>();
for (const [name, abbrevs] of BOOKS) {
  BOOK_INDEX.set(name.toLowerCase().replace(/[^a-z0-9]/g, ""), name);
  for (const a of abbrevs) BOOK_INDEX.set(a, name);
}

function canonicalBook(raw: string): string | null {
  const key = raw.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]/g, "");
  return BOOK_INDEX.get(key) ?? null;
}

interface ParsedRef {
  book: string;
  chapter: number;
  from: number | null; // null = whole chapter (capped)
  to: number | null;
}

/** Parses "John 3:16", "1 Cor. 13:4-7", "Psalm 23", "Ps 46:1,2" (first range only). */
export function parseRef(input: string): ParsedRef | null {
  const s = input.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  const m = s.match(/^((?:[1-3]|I{1,3})?\s*[A-Za-z][A-Za-z .]*?)\s*(\d{1,3})(?::(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?(?:[,;].*)?$/);
  if (!m) return null;
  const book = canonicalBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  const from = m[3] ? Number(m[3]) : null;
  const to = m[4] ? Number(m[4]) : from;
  if (!chapter || (from !== null && (!from || (to !== null && to < from)))) return null;
  return { book, chapter, from, to };
}

export function formatRef(p: ParsedRef, verses: number[]): string {
  const book = p.book === "Psalms" ? "Psalm" : p.book; // one psalm, as people say it
  if (!verses.length) return `${book} ${p.chapter}`;
  const first = verses[0];
  const last = verses[verses.length - 1];
  return first === last ? `${book} ${p.chapter}:${first}` : `${book} ${p.chapter}:${first}-${last}`;
}

/**
 * Looks each reference up. Unknown books, bad chapters, or missing verses come
 * back with verified=false and no text.
 */
export async function verifyRefs(
  admin: Admin,
  refs: { ref?: string; translation?: string }[],
  preferredTranslation = "WEB",
): Promise<VerifiedRef[]> {
  const out: VerifiedRef[] = [];
  const translation = "WEB"; // KJV loads later; everything verifies against WEB for now.
  const seen = new Set<string>();
  for (const r of refs.slice(0, MAX_REFS)) {
    const raw = (r.ref ?? "").trim();
    if (!raw) continue;
    const parsed = parseRef(raw);
    if (!parsed) {
      out.push({ ref: raw, translation: preferredTranslation, verified: false });
      continue;
    }
    const from = parsed.from ?? 1;
    const to = Math.min(parsed.to ?? (parsed.from ?? MAX_VERSES_PER_REF), from + MAX_VERSES_PER_REF - 1);
    const key = `${parsed.book}|${parsed.chapter}|${from}|${to}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const { data, error } = await admin
      .from("bible_verses")
      .select("verse, text")
      .eq("translation", translation)
      .eq("book", parsed.book)
      .eq("chapter", parsed.chapter)
      .gte("verse", from)
      .lte("verse", to)
      .order("verse", { ascending: true });
    if (error) {
      console.warn("scripture lookup failed", error.message);
      out.push({ ref: raw, translation, verified: false });
      continue;
    }
    const rows = (data ?? []) as { verse: number; text: string }[];
    if (!rows.length) {
      out.push({ ref: formatRef(parsed, parsed.from ? [from, to] : []), translation, verified: false });
      continue;
    }
    const verses = rows.map((x) => x.verse);
    const text = rows.length === 1
      ? rows[0].text
      : rows.map((x) => `${x.verse} ${x.text}`).join(" ");
    out.push({
      ref: formatRef(parsed, verses),
      translation,
      verified: true,
      text,
      book: parsed.book,
      chapter: parsed.chapter,
      verses,
    });
  }
  return out;
}

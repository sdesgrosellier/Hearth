import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

// Bundle the chat function + _shared into one Deno-compatible TS file for the
// dashboard editor. The npm: import of supabase-js is kept external (Deno resolves it).
const result = await esbuild.build({
  entryPoints: ["/home/claude/hearth/supabase/functions/chat/index.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "esnext",
  write: false,
  external: ["npm:*", "jsr:*", "node:*"],
  loader: { ".json": "json" },
  legalComments: "none",
  minify: false,
  treeShaking: true,
  logLevel: "warning",
});
let code = result.outputFiles[0].text;
const header = `// Hearth — chat Edge Function (single-file build for dashboard deploy)
// Source of truth: supabase/functions/chat/index.ts + _shared/*. Rebuild with: node scripts/bundle-function.mjs
`;
writeFileSync("/home/claude/hearth/supabase/functions/chat/index.bundled.js", header + code);
console.log("bundled bytes:", code.length);

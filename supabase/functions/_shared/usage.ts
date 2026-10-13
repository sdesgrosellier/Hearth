// Beta guardrail: a per-user monthly token budget. Set BETA_MONTHLY_TOKENS as an
// Edge Function secret to change it (0 disables the cap).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

export const MONTHLY_TOKEN_CAP = Number(Deno.env.get("BETA_MONTHLY_TOKENS") ?? "1500000") || 0;

export const CAP_MESSAGE =
  "You've used this month's beta allowance. It resets on the 1st; message Shane if you need more before then.";

/** True when the user has exhausted this month's budget. */
export async function overMonthlyCap(admin: Admin, userId: string): Promise<boolean> {
  if (!MONTHLY_TOKEN_CAP) return false;
  const period = new Date();
  const periodStart = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const { data } = await admin
    .from("usage")
    .select("llm_input_tokens, llm_output_tokens")
    .eq("user_id", userId)
    .eq("period", periodStart)
    .maybeSingle();
  if (!data) return false;
  const used = Number(data.llm_input_tokens ?? 0) + Number(data.llm_output_tokens ?? 0);
  return used >= MONTHLY_TOKEN_CAP;
}

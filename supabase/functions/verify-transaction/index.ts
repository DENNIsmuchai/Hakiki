// Supabase Edge Function: verify-transaction
//
// Recomputes a transaction's tamper-evident hash from its CURRENT order +
// payments data and compares it to the hash stored at the time the order was
// settled (FR10). If anything in the underlying record has changed since,
// the hashes won't match — that's the whole point.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { computeTransactionHash } from "../_shared/hash.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const { transactionId } = await req.json();
    if (!transactionId) return json({ ok: false, error: "transactionId is required." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: txn, error } = await admin
      .from("transactions")
      .select("transaction_hash")
      .eq("id", transactionId)
      .maybeSingle();
    if (error || !txn) return json({ ok: false, error: "Transaction not found." }, 404);

    if (!txn.transaction_hash) {
      return json({ ok: true, valid: null, note: "Not yet anchored — no hash recorded." });
    }

    const { hash: computedHash } = await computeTransactionHash(admin, transactionId);
    const valid = txn.transaction_hash === computedHash;

    return json({ ok: true, valid, storedHash: txn.transaction_hash, computedHash });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Supabase Edge Function: mark-verified
//
// Marks a transaction as buyer-verified. Runs with the SERVICE ROLE because a
// buyer is NOT the seller, so the client-side RLS UPDATE policy (scoped to
// seller_id = auth.uid()) would block a direct client update. Keeping this
// server-side also prevents a buyer from marking arbitrary transactions.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const { transactionId } = await req.json();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await admin
    .from("transactions")
    .update({ buyer_verified: true, buyer_verified_at: new Date().toISOString() })
    .eq("id", transactionId);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await admin.from("audit_events").insert({
    transaction_id: transactionId,
    event_type: "buyer_verified",
    message: "Buyer identity verified via phone match + OTP.",
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

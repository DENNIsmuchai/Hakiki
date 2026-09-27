// Supabase Edge Function: verify-phone-match
//
// Security model:
//  - Runs with the SERVICE ROLE, so it can read buyer_phone_encrypted.
//  - Decrypts the stored phone SERVER-SIDE and compares to enteredPhone.
//  - Returns ONLY { match: boolean }. The plaintext number is NEVER sent to the
//    client (the client only ever sends transactionId + enteredPhone).
//
// TODO: replace the base64 stub with real AES-256-GCM decryption using a key
// from Supabase Vault / KMS. The client stored base64 today, mirroring that.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function decrypt(encrypted: string): string {
  // STUB: matches client-side base64 placeholder in src/lib/crypto.js.
  return new TextDecoder().decode(Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0)));
}

function normalize(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) return "254" + d.slice(1);
  if (d.startsWith("254")) return d;
  return d;
}

Deno.serve(async (req) => {
  const { transactionId, enteredPhone } = await req.json();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from("transactions")
    .select("buyer_phone_encrypted")
    .eq("id", transactionId)
    .maybeSingle();

  if (error || !data) {
    // Do not reveal existence. Just say no match.
    return new Response(JSON.stringify({ match: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const stored = decrypt(data.buyer_phone_encrypted);
  const match = normalize(stored) === normalize(enteredPhone ?? "");

  return new Response(JSON.stringify({ match }), {
    headers: { "Content-Type": "application/json" },
  });
});

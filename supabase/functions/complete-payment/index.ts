// Supabase Edge Function: complete-payment
//
// The browser must call THIS function, never supabase.from("payments").insert(...)
// directly — `payments` has no client insert policy under RLS. This function:
//
//   1. Idempotency     — a repeated provider reference never double-inserts (FR/NFR reliability).
//   2. Reconciliation  — compares the charged amount to what's actually owed (FR7).
//   3. Anomaly detection — flags (never silently blocks) overpayment / repeated
//      attempts for a human to review (FR12).
//   4. Hash anchoring  — once the order is fully paid, computes and stores a
//      tamper-evident SHA-256 hash of the transaction record (FR10).
//   5. Audit trail     — writes an audit_events row for each of the above (FR8).
//
// In production this function should also perform the real charge server-side
// (e.g. with a payment provider secret from Supabase Vault), keeping any
// provider secret off the client. Today it trusts the reference produced by
// the client-side Mock payment provider (src/services/payments/provider.js).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { computeTransactionHash } from "../_shared/hash.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REPEATED_ATTEMPT_WINDOW_MIN = 5;
const REPEATED_ATTEMPT_THRESHOLD = 5;

Deno.serve(async (req) => {
  try {
    const { transactionId, amount, loopReferenceId, paymentId } = await req.json();

    const chargedAmount = Number(amount);
    if (!transactionId || !loopReferenceId || !Number.isFinite(chargedAmount) || chargedAmount <= 0) {
      return json({ ok: false, error: "Invalid payment payload." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Idempotency — never insert the same provider reference twice
    // (handles the buyer's app retrying after a network blip).
    const { data: existing } = await admin
      .from("payments")
      .select("id")
      .eq("transaction_id", transactionId)
      .eq("loop_reference_id", loopReferenceId)
      .maybeSingle();
    if (existing) {
      return json({ ok: true, duplicate: true });
    }

    // 2. Load the order and what's already been paid.
    const { data: txn, error: txnErr } = await admin
      .from("transactions")
      .select("id, total_amount, status, anomaly_flags")
      .eq("id", transactionId)
      .maybeSingle();
    if (txnErr || !txn) {
      return json({ ok: false, error: "Transaction not found." }, 404);
    }
    if (["cancelled", "expired"].includes(txn.status)) {
      return json(
        { ok: false, error: `This order is ${txn.status} and can no longer accept payments.` },
        409
      );
    }

    const { data: completedPayments, error: payErr } = await admin
      .from("payments")
      .select("amount")
      .eq("transaction_id", transactionId)
      .eq("status", "completed");
    if (payErr) return json({ ok: false, error: payErr.message }, 400);

    const paidSoFar = (completedPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(txn.total_amount) - paidSoFar;

    if (remaining <= 0) {
      return json({ ok: false, error: "This order is already fully paid." }, 409);
    }

    // 3. Reconciliation / anomaly detection — flag, don't auto-accuse (FR7/FR12).
    const flags: string[] = [];
    if (chargedAmount > remaining + 0.01) flags.push("amount_exceeds_balance");

    const windowStart = new Date(Date.now() - REPEATED_ATTEMPT_WINDOW_MIN * 60_000).toISOString();
    const { count: recentAttempts } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("transaction_id", transactionId)
      .gte("created_at", windowStart);
    if ((recentAttempts ?? 0) >= REPEATED_ATTEMPT_THRESHOLD) flags.push("repeated_attempts");

    // 4. Record the payment. A DB trigger recomputes transaction status
    // (partially_paid / fully_paid) from the payments ledger.
    const { error: insertErr } = await admin.from("payments").insert({
      transaction_id: transactionId,
      amount: chargedAmount,
      loop_reference_id: loopReferenceId,
      status: "completed",
      payment_hash: paymentId ?? null,
    });
    if (insertErr) return json({ ok: false, error: insertErr.message }, 400);

    await admin.from("audit_events").insert({
      transaction_id: transactionId,
      event_type: "payment_verified",
      message: `Payment of ${chargedAmount} verified (ref ${loopReferenceId}).`,
      meta: { amount: chargedAmount, reference: loopReferenceId },
    });

    if (flags.length > 0) {
      const existingFlags: string[] = Array.isArray(txn.anomaly_flags) ? txn.anomaly_flags : [];
      const merged = Array.from(new Set([...existingFlags, ...flags]));
      await admin
        .from("transactions")
        .update({ payment_mismatch: true, anomaly_flags: merged })
        .eq("id", transactionId);
      await admin.from("audit_events").insert({
        transaction_id: transactionId,
        event_type: "anomaly_flagged",
        message: `Anomaly detected: ${flags.join(", ")}.`,
        meta: { flags },
      });
    }

    // 5. If this payment settles the order, anchor a tamper-evident hash.
    const newPaidTotal = paidSoFar + chargedAmount;
    if (newPaidTotal >= Number(txn.total_amount)) {
      const { hash, blockchainTxId } = await computeTransactionHash(admin, transactionId);
      await admin
        .from("transactions")
        .update({ transaction_hash: hash, blockchain_tx_id: blockchainTxId })
        .eq("id", transactionId)
        .is("transaction_hash", null);
      await admin.from("audit_events").insert({
        transaction_id: transactionId,
        event_type: "hash_recorded",
        message: "Transaction record hashed and anchored.",
        meta: { hash, blockchainTxId },
      });
    }

    return json({ ok: true, mismatch: flags.length > 0, flags });
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

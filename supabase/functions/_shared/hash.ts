// Shared by complete-payment and verify-transaction so both compute the
// tamper-evident transaction hash the exact same way (FR10). If this drifts
// between the two functions, "verify" would always report a mismatch.
//
// The hash never includes buyer PII (name, phone) — only order + payment
// facts — so it can be safely shown to the buyer and put in a receipt.

export async function computeTransactionHash(admin: any, transactionId: string) {
  const { data: txn, error: txnErr } = await admin
    .from("transactions")
    .select("id, items, total_amount, delivery_fee")
    .eq("id", transactionId)
    .single();
  if (txnErr || !txn) throw new Error("Transaction not found.");

  const { data: payments, error: payErr } = await admin
    .from("payments")
    .select("amount, loop_reference_id, created_at")
    .eq("transaction_id", transactionId)
    .eq("status", "completed")
    .order("created_at", { ascending: true });
  if (payErr) throw new Error(payErr.message);

  const canonical = {
    transaction_id: txn.id,
    total_amount: Number(txn.total_amount),
    delivery_fee: Number(txn.delivery_fee ?? 0),
    items: txn.items ?? [],
    payments: (payments ?? []).map((p: any) => ({
      amount: Number(p.amount),
      reference: p.loop_reference_id,
    })),
  };

  const bytes = new TextEncoder().encode(stableStringify(canonical));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return { hash: `0x${hex}`, blockchainTxId: `MOCKCHAIN-${hex.slice(0, 16)}` };
}

// Deterministic JSON.stringify — sorts object keys so the same data always
// produces the same bytes regardless of column/property order.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

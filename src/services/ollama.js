// ---------------------------------------------------------------------------
// AI (Ollama) read-only assistant for the seller dashboard.
//
// This module is intentionally side-effect free and READ-ONLY. It never
// writes to Supabase, never calls mutating RPCs, and never triggers any
// transaction state change. It only:
//   1. Formats the seller's existing transactions + payments as text.
//   2. Sends that summary + the seller's question to an Ollama endpoint.
//   3. Returns the model's text response.
//
// If the seller's question implies an action (e.g. "cancel transaction X"),
// the prompt instructs the model to explain that the seller must use the
// dashboard buttons instead of attempting the action.
// ---------------------------------------------------------------------------

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || "llama3.2";

const SYSTEM_PROMPT = `You are a helpful, read-only assistant for a seller's payment-link dashboard (Hakiki).

You are given a compact text summary of the seller's transactions and their payments.
Answer the seller's question using ONLY that data. Be concise and factual.

STRICT RULES:
- You may only READ and summarize the data provided. You must NOT suggest,
  describe, or imply any way to modify, cancel, expire, resend, or change
  the status of any transaction.
- If the seller asks you to perform an action (e.g. "cancel transaction X",
  "resend the link", "mark it as paid", "delete this"), do NOT attempt it.
  Instead, explain that you are read-only and tell them to use the buttons
  and controls visible on the dashboard for that action.
- If the data does not contain enough information to answer, say so plainly.
- Do not invent numbers, dates, or statuses that are not in the data.
- Keep answers short: 1-4 sentences unless the data clearly warrants more.`;

/**
 * Build a compact, human-readable text summary of transactions + payments.
 * This is the only data the model is allowed to see.
 */
export function formatTransactionSummary({ transactions = [], payments = [] }) {
  if (!transactions.length) {
    return "TRANSACTIONS SUMMARY:\n- The seller has 0 transactions yet.";
  }

  const paidByTxn = {};
  for (const p of payments) {
    if (p.status === "completed") {
      paidByTxn[p.transaction_id] = (paidByTxn[p.transaction_id] || 0) + Number(p.amount);
    }
  }

  const lines = ["TRANSACTIONS SUMMARY:"];

  for (const t of transactions) {
    const total = Number(t.total_amount);
    const paid = paidByTxn[t.id] || 0;
    const remaining = Math.max(0, total - paid);
    const created = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : "—";
    const expires = t.link_expires_at ? new Date(t.link_expires_at).toISOString().slice(0, 10) : "—";

    lines.push(
      `- "${t.item_name}" | total=${total} | paid=${paid} | remaining=${remaining} | status=${t.status} | buyer_last4=${t.buyer_phone_last4 || "—"} | created=${created} | link_expires=${expires}`
    );
  }

  return lines.join("\n");
}

/**
 * Ask the Ollama model a question about the seller's transactions.
 * Returns the model's text response (string).
 *
 * @param {{ transactions: object[], payments: object[] }} data - from fetchDashboard()
 * @param {string} question - the seller's free-text question
 * @param {object} [opts] - optional overrides (fetch, signal)
 */
export async function askAboutTransactions(data, question, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const signal = opts.signal;

  const summary = formatTransactionSummary(data);
  const userPrompt = `${summary}\n\nSELLER QUESTION: ${question.trim() || "(no question provided)"}`;

  const res = await fetchImpl(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      stream: false,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed with status ${res.status}`);
  }

  const json = await res.json();
  if (typeof json?.response !== "string") {
    throw new Error("Ollama response was malformed (missing 'response' field).");
  }
  return json.response;
}
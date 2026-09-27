import { useState } from "react";
import { askAboutTransactions } from "../services/ollama";
import { Button } from "./Button";
import { Card } from "./Card";

/**
 * Read-only AI chat panel for the seller dashboard.
 *
 * - Uses the parent-provided `data` prop, which already respects Supabase RLS
 *   through fetchDashboard().
 * - Sends a compact text summary + the seller's question to Ollama.
 * - Displays the model's plain-text response.
 *
 * This component never mutates any data. It is purely a read + display UI.
 */
export default function AIChat({ data, loading }) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const hasTransactions = (data?.transactions?.length || 0) > 0;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!hasTransactions) {
      // Friendly message when there are zero transactions — no broken state.
      setResponse(
        "You don't have any transactions yet. Create your first payment link to get started, then come back and ask me about your sales."
      );
      setError(null);
      return;
    }

    const trimmed = question.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    setResponse("");
    try {
      const answer = await askAboutTransactions(data, trimmed);
      setResponse(answer);
    } catch (err) {
      setError(err?.message || "Could not reach the AI assistant. Is Ollama running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-brand-yellow/10 flex items-center justify-center text-lg">
            ✦
          </div>
          <div>
            <h3 className="font-display text-2xl tracking-wide text-navy">
              Ask about your transactions
            </h3>
            <p className="font-mono text-xs text-navy-400">
              Read-only · answers are based only on your current data
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="e.g. Which transactions still need payment?"
            className="w-full resize-y rounded-xl border-2 border-navy/10 bg-paper/60 px-4 py-3 font-body text-base text-navy placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            disabled={busy || loading}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="font-mono text-[11px] text-navy-400">
              {hasTransactions
                ? `${data.transactions.length} transaction(s) in context`
                : "No transactions in context"}
            </span>
            <Button type="submit" variant="primary" size="md" disabled={busy || loading || !hasTransactions}>
              {busy ? "Thinking…" : "Ask"}
            </Button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border-2 border-terracotta-light bg-terracotta-light p-4">
            <p className="font-body text-terracotta text-sm">
              <span className="font-bold">Error:</span> {error}
            </p>
          </div>
        )}

        {response && (
          <div className="mt-4 rounded-xl border-2 border-navy/10 bg-paper/60 p-4">
            <p className="font-mono text-[11px] uppercase tracking-widest text-navy-400 mb-2">
              Response
            </p>
            <p className="font-body text-base text-navy whitespace-pre-wrap leading-relaxed">
              {response}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatCurrency, formatDate, formatRelativeTime } from "../lib/format";
import {
  fetchTransaction,
  cancelTransaction,
  regenerateLink,
  verifyTransactionIntegrity,
} from "../services/transactions";
import { useToast } from "../components/Toast";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

function StatusBadge({ status }) {
  const config = {
    awaiting_verification: { bg: "bg-navy-100", text: "text-navy-500", label: "Awaiting Verification" },
    verified: { bg: "bg-sky-light", text: "text-sky", label: "Verified" },
    partially_paid: { bg: "bg-brand-yellow/15", text: "text-navy", label: "Partially Paid" },
    fully_paid: { bg: "bg-savanna-light", text: "text-savanna", label: "Fully Paid" },
    expired: { bg: "bg-terracotta-light", text: "text-terracotta", label: "Expired" },
    cancelled: { bg: "bg-navy-100", text: "text-navy-400", label: "Cancelled" },
  };
  const c = config[status] || config.awaiting_verification;
  const isCancelled = status === "cancelled";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${c.bg} ${c.text} ${isCancelled ? "line-through decoration-navy-300" : ""}`}
    >
      {c.label}
    </span>
  );
}

function formatRemaining(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [transaction, setTransaction] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [copied, setCopied] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTransaction(id)
      .then((res) => {
        if (!active) return;
        setTransaction(res.transaction);
        setPayments(res.payments || []);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Failed to load transaction.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const paid = useMemo(
    () =>
      payments
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [payments]
  );

  const total = transaction ? Number(transaction.total_amount) : 0;
  const remaining = Math.max(0, total - paid);
  const rawExpiry = transaction?.link_expires_at ?? null;
  const expired = rawExpiry ? new Date(rawExpiry).getTime() <= Date.now() : false;
  const canRegenerate = transaction && remaining > 0 && expired;

  async function copyLink() {
    if (!transaction) return;
    const url = `https://pay.hakiki.app/pay/${transaction.link_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Couldn't copy — copy it manually.");
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setActionError(null);
    try {
      const res = await regenerateLink(id);
      setTransaction((prev) => ({ ...prev, link_token: res.link_token, link_expires_at: res.link_expires_at }));
      showToast("Link regenerated");
    } catch (err) {
      setActionError(err?.message || "Could not regenerate link.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleVerifyIntegrity() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyTransactionIntegrity(id);
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ ok: false, error: err?.message || "Could not verify integrity." });
    } finally {
      setVerifying(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setActionError(null);
    try {
      const res = await cancelTransaction(id);
      setTransaction((prev) => ({ ...prev, status: res.status }));
      showToast("Transaction cancelled");
      setConfirmingCancel(false);
    } catch (err) {
      setActionError(err?.message || "Could not cancel transaction.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-5 py-10 animate-pulse space-y-4">
        <div className="h-5 w-32 bg-navy/5 rounded-lg" />
        <div className="h-40 bg-navy/5 rounded-xl" />
        <div className="h-28 bg-navy/5 rounded-xl" />
        <div className="h-36 bg-navy/5 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-5 py-10">
        <Link to="/seller" className="font-mono text-sm text-brand-yellow-deep hover:underline">
          ← Back to dashboard
        </Link>
        <Card className="mt-5 border-terracotta-light bg-terracotta-light">
          <p className="font-body text-terracotta text-sm">{error}</p>
        </Card>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen max-w-4xl mx-auto px-5 py-10 text-center">
        <div className="text-5xl mb-3">🔗</div>
        <p className="font-display text-3xl tracking-wide text-navy">Transaction not found</p>
        <p className="font-body text-navy-500 mt-2 text-sm">
          That link may be invalid or the transaction was removed.
        </p>
        <Link to="/seller">
          <Button variant="primary" size="lg" className="mt-5">
            Back to dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/pay/${transaction.link_token}`;
  const remainingLabel = formatRemaining(transaction.link_expires_at);

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-5 py-10 space-y-6">
        {/* Back link */}
        <Link
          to="/seller"
          className="inline-flex items-center gap-2 font-mono text-sm text-brand-yellow-deep hover:text-brand-yellow transition-colors"
        >
          ← Back to dashboard
        </Link>

        {actionError && (
          <Card className="border-terracotta-light bg-terracotta-light">
            <p className="font-body text-terracotta text-sm">{actionError}</p>
          </Card>
        )}

        {/* Anomaly / reconciliation banner (FR7 / FR12) — flags, never hides. */}
        {(transaction.payment_mismatch || (transaction.anomaly_flags || []).length > 0) && (
          <Card className="border-terracotta-light bg-terracotta-light p-4">
            <p className="font-body font-bold text-terracotta text-sm uppercase tracking-wider mb-1">
              ⚠️ Flagged for review
            </p>
            <p className="font-body text-terracotta text-sm">
              {(transaction.anomaly_flags || []).includes("amount_exceeds_balance") &&
                "A payment came in for more than the remaining balance. "}
              {(transaction.anomaly_flags || []).includes("repeated_attempts") &&
                "Several payment attempts were made in a short window. "}
              This doesn't block the order — review the payment ledger below before fulfilling.
            </p>
          </Card>
        )}

        {/* Item card */}
        <Card className="p-5 md:p-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {transaction.item_photo_url ? (
              <img
                src={transaction.item_photo_url}
                alt=""
                className="w-full sm:w-36 h-44 sm:h-36 object-cover rounded-xl border-2 border-navy/5 shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-full sm:w-36 h-44 sm:h-36 rounded-xl border-2 border-navy/5 bg-navy-50 flex items-center justify-center font-display text-navy/20 text-4xl shrink-0">
                {transaction.item_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl md:text-4xl tracking-wide text-navy break-words">
                {transaction.item_name}
              </h1>
              {Array.isArray(transaction.items) && transaction.items.length > 0 ? (
                <div className="mt-3 divide-y divide-navy/5 border-y border-navy/5">
                  {transaction.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between py-1.5 font-body text-sm">
                      <span className="text-navy-600">
                        {it.name} × {it.quantity}
                      </span>
                      <span className="font-mono text-navy-500">
                        {formatCurrency(Number(it.unit_price) * Number(it.quantity))}
                      </span>
                    </div>
                  ))}
                  {Number(transaction.delivery_fee) > 0 && (
                    <div className="flex justify-between py-1.5 font-body text-sm">
                      <span className="text-navy-600">Delivery</span>
                      <span className="font-mono text-navy-500">
                        {formatCurrency(Number(transaction.delivery_fee))}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                transaction.item_description && (
                  <p className="font-body text-navy-500 mt-2 text-sm leading-relaxed">
                    {transaction.item_description}
                  </p>
                )
              )}
              <p className="font-mono text-xl mt-3 font-semibold text-navy">{formatCurrency(total)}</p>
            </div>
          </div>
        </Card>

        {/* Buyer verification */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-navy-400 mb-1">
                Buyer
              </p>
              <p className="font-mono text-sm font-semibold text-navy">
                •••• {transaction.buyer_phone_last4}
              </p>
            </div>
            <div className="text-right">
              {transaction.buyer_verified ? (
                <>
                  <StatusBadge status="verified" />
                  {transaction.buyer_verified_at && (
                    <p className="font-mono text-[11px] text-navy-400 mt-1">
                      verified {formatRelativeTime(transaction.buyer_verified_at)}
                    </p>
                  )}
                </>
              ) : (
                <StatusBadge status="awaiting_verification" />
              )}
            </div>
          </div>
        </Card>

        {/* Link status */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-navy-400">
              Payment link
            </p>
            <StatusBadge status={expired ? "expired" : "verified"} />
          </div>
          <p className="font-body text-sm text-navy-500 mb-3">
            {expired
              ? "This link has expired."
              : remainingLabel
                ? `Active · expires in ${remainingLabel}`
                : "Active"}
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 border-2 border-navy/10 rounded-lg px-3 py-2.5 font-mono text-xs bg-navy-50/50 text-navy"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={copyLink}
              className="whitespace-nowrap"
            >
              {copied ? "✓ Copied" : "Copy link"}
            </Button>
          </div>
          {canRegenerate && (
            <Button
              variant="deep"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="mt-3"
            >
              {regenerating ? "Regenerating…" : "Regenerate link"}
            </Button>
          )}
        </Card>

        {/* Payment ledger */}
        <Card className="p-5 md:p-6 overflow-hidden">
          <h2 className="font-display text-xl tracking-wide text-navy mb-4">Payment ledger</h2>
          {payments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">💳</p>
              <p className="font-body text-navy-500 text-sm">No payments yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-navy/10">
                    <th className="p-2.5 font-mono text-[11px] uppercase tracking-widest text-navy-400 font-normal">
                      Amount
                    </th>
                    <th className="p-2.5 font-mono text-[11px] uppercase tracking-widest text-navy-400 font-normal">
                      Status
                    </th>
                    <th className="p-2.5 font-mono text-[11px] uppercase tracking-widest text-navy-400 font-normal">
                      Loop ref
                    </th>
                    <th className="p-2.5 font-mono text-[11px] uppercase tracking-widest text-navy-400 font-normal">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="font-body divide-y divide-navy/5">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-navy-50/50 transition-colors">
                      <td className="p-2.5 font-mono font-semibold text-sm">{formatCurrency(Number(p.amount))}</td>
                      <td className="p-2.5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="p-2.5 font-mono text-xs text-navy-500">{p.loop_reference_id}</td>
                      <td className="p-2.5 font-mono text-xs text-navy-500">
                        {formatDate(p.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Balance summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="font-mono text-[11px] uppercase text-navy-400 mb-1">Total</p>
            <p className="font-display text-xl text-navy">{formatCurrency(total)}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="font-mono text-[11px] uppercase text-navy-400 mb-1">Paid</p>
            <p className="font-display text-xl text-savanna">{formatCurrency(paid)}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="font-mono text-[11px] uppercase text-navy-400 mb-1">Remaining</p>
            <p className="font-display text-xl text-brand-yellow-deep">{formatCurrency(remaining)}</p>
          </Card>
        </div>

        {/* Blockchain proof */}
        <Card className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-navy-400 mb-2">
            Blockchain proof
          </p>
          {transaction.transaction_hash ? (
            <>
              <p className="font-mono text-xs break-all bg-navy-50/50 rounded-lg p-2.5 border-2 border-navy/5 text-navy-600">
                {transaction.transaction_hash}
              </p>
              <a
                href={`https://explorer.hakiki.testnet/#/tx/${transaction.transaction_hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-2.5 font-body font-bold text-brand-yellow-deep hover:text-brand-yellow-deep/80 transition-colors text-sm"
              >
                View on explorer →
              </a>
              <div className="mt-3 flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={handleVerifyIntegrity} disabled={verifying}>
                  {verifying ? "Verifying…" : "Verify integrity"}
                </Button>
                {verifyResult && verifyResult.ok && verifyResult.valid === true && (
                  <span className="font-mono text-xs text-savanna font-bold">✓ Record matches hash</span>
                )}
                {verifyResult && verifyResult.ok && verifyResult.valid === false && (
                  <span className="font-mono text-xs text-terracotta font-bold">
                    ✕ Record does not match — investigate
                  </span>
                )}
                {verifyResult && verifyResult.ok && verifyResult.valid === null && (
                  <span className="font-mono text-xs text-navy-400">{verifyResult.note}</span>
                )}
                {verifyResult && verifyResult.ok === false && (
                  <span className="font-mono text-xs text-terracotta">{verifyResult.error}</span>
                )}
              </div>
            </>
          ) : (
            <p className="font-body text-navy-500 text-sm">Not yet anchored</p>
          )}
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <Button variant="secondary" size="md" onClick={() => showToast("Link resent to buyer (stub)")}>
            Resend link
          </Button>
          {!confirmingCancel ? (
            <Button
              variant="danger"
              size="md"
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel transaction
            </Button>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="font-body text-xs text-navy-500">Cancel this transaction?</span>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling…" : "Confirm cancel"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingCancel(false)}
              >
                Keep
              </Button>
            </div>
          )}
        </div>

        {/* Receipt modal */}
        {receiptOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm"
            onClick={() => setReceiptOpen(false)}
          >
            <Card
              className="max-w-md w-full p-6 relative border-2 border-navy/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setReceiptOpen(false)}
                className="absolute top-3 right-3 font-mono text-sm text-navy-400 hover:text-navy transition-colors"
              >
                ✕
              </button>
              <div className="text-center mb-5">
                <div className="w-14 h-14 mx-auto rounded-full bg-savanna-light flex items-center justify-center text-2xl text-savanna mb-3">
                  ✓
                </div>
                <h3 className="font-display text-3xl tracking-wide text-navy">Receipt</h3>
              </div>
              <dl className="space-y-2.5 font-body text-sm">
                <div className="flex justify-between">
                  <dt className="text-navy-500">Item</dt>
                  <dd className="font-bold text-right text-navy">{transaction.item_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-navy-500">Buyer</dt>
                  <dd className="font-mono text-navy">•••• {transaction.buyer_phone_last4}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-navy-500">Total</dt>
                  <dd className="font-mono font-semibold text-navy">{formatCurrency(total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-navy-500">Paid</dt>
                  <dd className="font-mono font-semibold text-savanna">{formatCurrency(paid)}</dd>
                </div>
              </dl>
              <div className="mt-5 pt-4 border-t-2 border-navy/10">
                <p className="font-mono text-[11px] uppercase text-navy-400 mb-2">Payments</p>
                {payments.length === 0 ? (
                  <p className="font-body text-sm text-navy-500">No payments yet.</p>
                ) : (
                  <ul className="space-y-1.5 font-mono text-sm">
                    {payments.map((p) => (
                      <li key={p.id} className="flex justify-between text-navy">
                        <span>{formatCurrency(Number(p.amount))}</span>
                        <span className="text-navy-400">{p.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-4">
                <p className="font-mono text-[11px] uppercase text-navy-400 mb-1">Hash</p>
                <p className="font-mono text-[11px] break-all bg-navy-50/50 rounded-lg p-2 border-2 border-navy/5 text-navy-600">
                  {transaction.transaction_hash || "Not yet anchored"}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

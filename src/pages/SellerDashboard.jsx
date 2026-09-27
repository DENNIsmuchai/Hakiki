import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { formatCurrency, formatRelativeTime } from "../lib/format";
import { fetchDashboard } from "../services/transactions";
import { useToast } from "../components/Toast";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import AIChat from "../components/AIChat";

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

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-5 border-b-2 border-navy/5">
      <div className="w-16 h-16 rounded-xl bg-navy/5 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 bg-navy/5 rounded-lg animate-pulse" />
        <div className="h-3 w-24 bg-navy/5 rounded-lg animate-pulse" />
      </div>
      <div className="h-6 w-24 bg-navy/5 rounded-full animate-pulse" />
    </div>
  );
}

export default function SellerDashboard() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err?.message || "Failed to load dashboard."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const { transactions = [], payments = [] } = data || {};

  const paidByTxn = useMemo(() => {
    const map = {};
    for (const p of payments) {
      if (p.status === "completed") map[p.transaction_id] = (map[p.transaction_id] || 0) + Number(p.amount);
    }
    return map;
  }, [payments]);

  const stats = useMemo(() => {
    let collected = 0;
    let pending = 0;
    const attention = new Set();
    const soonMs = Date.now() + 60 * 60 * 1000;

    for (const t of transactions) {
      const paid = paidByTxn[t.id] || 0;
      collected += paid;
      if (["awaiting_verification", "verified", "partially_paid"].includes(t.status)) {
        pending += Math.max(0, Number(t.total_amount) - paid);
      }
      if (t.status === "awaiting_verification") attention.add(t.id);
      if (t.link_expires_at) {
        const exp = new Date(t.link_expires_at).getTime();
        if (exp > Date.now() && exp <= soonMs) attention.add(t.id);
      }
    }
    return {
      collected: formatCurrency(collected),
      pending: formatCurrency(pending),
      attention: attention.size,
    };
  }, [transactions, paidByTxn]);

  return (
    <div className="min-h-screen bg-paper">
      {/* Kitenge header band */}
      <div
        className="w-full h-8 shrink-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='32' viewBox='0 0 60 32'%3E%3Crect width='60' height='32' fill='%23FFFEF7'/%3E%3Cpath d='M0 0 L30 0 L15 16 Z' fill='rgba(255,194,41,0.10)'/%3E%3Cpath d='M30 0 L60 0 L45 16 Z' fill='rgba(30,111,176,0.10)'/%3E%3Cpath d='M0 16 L30 16 L15 32 Z' fill='rgba(60,110,71,0.10)'/%3E%3Cpath d='M30 16 L60 16 L45 32 Z' fill='rgba(210,73,30,0.10)'/%3E%3Cpath d='M0 0 L0 16 L15 16 Z' fill='rgba(210,73,30,0.10)'/%3E%3Cpath d='M45 16 L60 16 L60 32 Z' fill='rgba(60,110,71,0.10)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat-x",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-5xl md:text-6xl tracking-wide text-navy">
              Dashboard
            </h1>
            <p className="font-body text-navy-500 mt-1 text-base max-w-xl">
              Track your verified transactions and payment links in one place.
            </p>
          </div>
          <Link to="/seller/new">
            <Button variant="primary" size="lg">
              <span className="text-2xl leading-none">+</span> New Transaction
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-brand-yellow/10 flex items-center justify-center text-base">
                💰
              </div>
              <p className="font-mono text-xs uppercase tracking-widest text-navy-500">
                Total Collected
              </p>
            </div>
            <p className="font-display text-3xl tracking-wide text-navy">
              {loading ? "—" : stats.collected}
            </p>
            <p className="font-mono text-xs text-navy-400 mt-1">All time</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-sky-light flex items-center justify-center text-base">
                ⏳
              </div>
              <p className="font-mono text-xs uppercase tracking-widest text-navy-500">
                Pending Balance
              </p>
            </div>
            <p className="font-display text-3xl tracking-wide text-navy">
              {loading ? "—" : stats.pending}
            </p>
            <p className="font-mono text-xs text-navy-400 mt-1">Awaiting payment</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-terracotta-light flex items-center justify-center text-base">
                ⚠️
              </div>
              <p className="font-mono text-xs uppercase tracking-widest text-navy-500">
                Needs Attention
              </p>
            </div>
            <p className="font-display text-3xl tracking-wide text-navy">
              {loading ? "—" : stats.attention}
            </p>
            <p className="font-mono text-xs text-navy-400 mt-1">Action required</p>
          </Card>
        </div>

        {/* Transactions */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl tracking-wide text-navy">Transactions</h2>
            <span className="font-mono text-xs text-navy-500 bg-navy-50 px-2.5 py-1 rounded-md border border-navy/10">
              {transactions.length} total
            </span>
          </div>

          {error && (
            <Card className="p-5 border-terracotta-light bg-terracotta-light">
              <p className="font-body text-terracotta text-sm">{error}</p>
            </Card>
          )}

          {loading && (
            <Card className="overflow-hidden p-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </Card>
          )}

          {!loading && !error && transactions.length === 0 && (
            <Card className="p-10 text-center border-dashed border-2 border-navy/15">
              <div className="text-5xl mb-3">📋</div>
              <p className="font-display text-3xl tracking-wide text-navy mb-2">
                No transactions yet
              </p>
              <p className="font-body text-navy-500 mb-6 max-w-sm mx-auto text-sm">
                Create your first verified payment link and share it with a buyer.
              </p>
              <Link to="/seller/new">
                <Button variant="primary" size="lg">
                  Create your first link
                </Button>
              </Link>
            </Card>
          )}

          {!loading && !error && transactions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {transactions.map((t) => {
                const paid = paidByTxn[t.id] || 0;
                const total = Number(t.total_amount);
                const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
                const remaining = Math.max(0, total - paid);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/seller/transaction/${t.id}`)}
                    className="group text-left w-full"
                  >
                    <Card className="overflow-hidden hover:shadow-soft-lg hover:-translate-y-0.5 cursor-pointer border-2 border-navy/5 hover:border-brand-yellow/20 transition-all duration-150">
                      {/* Image Frame — true color, no filter */}
                      <div className="relative h-44 bg-navy-50 overflow-hidden">
                        {t.item_photo_url ? (
                          <img
                            src={t.item_photo_url}
                            alt={t.item_name}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className="absolute inset-0 bg-navy-50 items-center justify-center font-display text-navy/20 text-5xl"
                          style={{ display: t.item_photo_url ? "none" : "flex" }}
                        >
                          {t.item_name.charAt(0)}
                        </div>
                        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                          {t.payment_mismatch && (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-terracotta-light text-terracotta"
                              title="Flagged for review"
                            >
                              ⚠️
                            </span>
                          )}
                          <StatusBadge status={t.status} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <h3 className="font-display text-xl tracking-wide text-navy truncate group-hover:text-brand-yellow-deep transition-colors">
                          {t.item_name}
                        </h3>
                        <p className="font-mono text-xs text-navy-400 mt-1">
                          •••• {t.buyer_phone_last4} · {formatRelativeTime(t.created_at)}
                        </p>

                        {/* Progress */}
                        <div className="mt-3">
                          <div className="flex justify-between font-mono text-[11px] text-navy-500 mb-1">
                            <span>{formatCurrency(paid)} paid</span>
                            <span>{formatCurrency(total)}</span>
                          </div>
                          <div className="h-1.5 bg-navy-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-brand-yellow to-brand-yellow-deep rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-3 pt-3 border-t border-navy/5 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-navy-400">
                            {remaining > 0 ? `${formatCurrency(remaining)} remaining` : "Settled"}
                          </span>
                          <span className="font-body text-xs text-brand-yellow-deep font-bold group-hover:underline">
                            View →
                          </span>
                        </div>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <AIChat data={data} loading={loading} />
      </div>
    </div>
  );
}

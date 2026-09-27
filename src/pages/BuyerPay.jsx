import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "../lib/format";
import { fetchPublicTransaction } from "../services/buyer";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

function PlaceholderPhoto({ name }) {
  return (
    <div className="w-full aspect-square rounded-3xl border-2 border-dashed border-navy/20 bg-navy-50/50 flex items-center justify-center">
      <span className="font-display text-navy/20 text-8xl">{name ? name.charAt(0).toUpperCase() : "?"}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-navy/5 last:border-0">
      <span className="font-body text-sm text-navy-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-navy text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function BuyerPay() {
  const { linkId } = useParams();
  const navigate = useNavigate();

  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setImageError(false);
    fetchPublicTransaction(linkId)
      .then((res) => active && setTxn(res))
      .catch((err) => active && setError(err?.message || "Something went wrong."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [linkId]);

  const isExpired = useMemo(
    () => txn && new Date(txn.link_expires_at).getTime() <= Date.now(),
    [txn]
  );
  const isCancelled = txn && txn.status === "cancelled";
  const isPartial = txn && txn.status === "partially_paid";
  const paid = txn ? Number(txn.paid_amount) : 0;
  const total = txn ? Number(txn.total_amount) : 0;
  const remaining = Math.max(0, total - paid);
  const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-50/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-32 bg-navy/5 rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-navy/5 rounded-3xl" />
              <div className="space-y-4">
                <div className="h-10 w-3/4 bg-navy/5 rounded-xl" />
                <div className="h-6 w-1/2 bg-navy/5 rounded-lg" />
                <div className="h-32 w-full bg-navy/5 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-navy-50/30 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4 text-center border-red-200 bg-red-50">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="font-display text-3xl tracking-wide text-navy">Something went wrong</p>
          <p className="font-body text-navy-500 mt-2">{error}</p>
          <Link to="/" className="Button primary mt-5 inline-block">Go home</Link>
        </Card>
      </div>
    );
  }

  if (!txn) {
    return (
      <div className="min-h-screen bg-navy-50/30 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">🔗</div>
          <p className="font-display text-3xl tracking-wide text-navy">This link isn't valid.</p>
        </Card>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="min-h-screen bg-navy-50/30 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4 text-center border-red-200 bg-red-50">
          <div className="text-5xl mb-4">🚫</div>
          <p className="font-display text-3xl tracking-wide text-navy">Transaction Cancelled</p>
          <p className="font-body text-navy-500 mt-2">This transaction was cancelled by the seller.</p>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-navy-50/30 flex items-center justify-center">
        <Card className="p-8 max-w-md w-full mx-4 text-center border-yellow-200 bg-yellow-50">
          <div className="text-5xl mb-4">⏰</div>
          <p className="font-display text-3xl tracking-wide text-navy">Link Expired</p>
          <p className="font-body text-navy-500 mt-2">This payment link has expired — ask the seller for a new one.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-50 via-paper to-brand-yellow/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-sm text-brand-yellow-deep hover:text-yellow-700 transition-colors mb-6"
        >
          ← Back to listings
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Product Image */}
          <div className="space-y-4">
            <Card className="overflow-hidden p-0 border-2 border-navy/5">
              {txn.item_photo_url && !imageError ? (
                <img
                  src={txn.item_photo_url}
                  alt={txn.item_name}
                  className="w-full aspect-square object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <PlaceholderPhoto name={txn.item_name} />
              )}
            </Card>

            {/* Transaction Info */}
            <Card className="p-6 border-2 border-navy/5">
              <h3 className="font-display text-2xl tracking-wide text-navy mb-4">Transaction Details</h3>
              <div className="space-y-0">
                <InfoRow label="Transaction ID" value={`#${txn.id?.slice(0, 8)}...`} />
                <InfoRow label="Created" value={formatDate(txn.created_at)} />
                <InfoRow label="Status" value={
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                    txn.status === 'fully_paid' ? 'bg-emerald-100 text-emerald-700' :
                    txn.status === 'partially_paid' ? 'bg-brand-yellow/20 text-navy' :
                    txn.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-navy-100 text-navy-600'
                  }`}>
                    {txn.status.replace(/_/g, ' ')}
                  </span>
                } />
                {txn.installment_count > 1 && (
                  <InfoRow label="Installments" value={`${txn.installment_count} payments`} />
                )}
              </div>
            </Card>
          </div>

          {/* Right: Product & Seller Info */}
          <div className="space-y-6">
            {/* Product Card */}
            <Card className="p-6 sm:p-8 border-2 border-navy/5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="font-display text-4xl sm:text-5xl tracking-wide text-navy leading-tight">
                  {txn.item_name}
                </h1>
                <div className="shrink-0">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-yellow/20 text-navy">
                    {txn.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <p className="font-body text-navy-600 text-lg leading-relaxed mb-6">
                {txn.item_description || "No description provided."}
              </p>

              {/* Price & Progress */}
              <div className="bg-navy-50/50 rounded-2xl p-5 border-2 border-navy/5 mb-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-navy-400 mb-1">Total Amount</p>
                    <p className="font-display text-4xl text-navy">{formatCurrency(total)}</p>
                  </div>
                  {isPartial && (
                    <div className="text-right">
                      <p className="font-mono text-xs uppercase tracking-widest text-navy-400 mb-1">Remaining</p>
                      <p className="font-display text-2xl text-brand-yellow-deep">{formatCurrency(remaining)}</p>
                    </div>
                  )}
                </div>

                {isPartial && (
                  <div className="mt-4">
                    <div className="flex justify-between font-mono text-xs text-navy-500 mb-2">
                      <span>{formatCurrency(paid)} paid</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-3 bg-navy-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-yellow to-brand-yellow-deep rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action */}
              {!isExpired && !isCancelled && (
                <Button
                  variant="primary"
                  size="xl"
                  className="w-full shadow-glow"
                  onClick={() => navigate(`/pay/${linkId}/verify`)}
                >
                  {isPartial ? `Pay ${formatCurrency(remaining)}` : "Pay Now"}
                </Button>
              )}
            </Card>

            {/* Seller Card */}
            <Card className="p-6 border-2 border-navy/5">
              <h3 className="font-display text-2xl tracking-wide text-navy mb-4">Seller Information</h3>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-yellow to-brand-yellow-deep flex items-center justify-center text-navy font-display text-2xl shadow-hard-sm shrink-0">
                  {txn.seller_name?.charAt(0)?.toUpperCase() || "S"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-bold text-navy text-lg">{txn.seller_name || "Seller"}</p>
                  <p className="font-mono text-sm text-navy-500 mt-1">{txn.seller_phone || "N/A"}</p>
                  {txn.seller_location && (
                    <p className="font-body text-sm text-navy-400 mt-1 flex items-center gap-1">
                      <span>📍</span> {txn.seller_location}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-mono text-xs text-navy-500">Secure payment powered by Hakiki</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

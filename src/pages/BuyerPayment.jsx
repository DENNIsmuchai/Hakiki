import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { fetchPublicTransaction, completePayment } from "../services/buyer";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

const PROCESSING_TIMEOUT = 90;

export default function BuyerPayment() {
  const { linkId } = useParams();
  const navigate = useNavigate();

  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [phase, setPhase] = useState("ready");
  const [failReason, setFailReason] = useState(null);
  const [timer, setTimer] = useState(PROCESSING_TIMEOUT);

  useEffect(() => {
    if (!sessionStorage.getItem(`hakiki_verified_${linkId}`)) {
      navigate(`/pay/${linkId}/verify`, { replace: true });
    }
  }, [linkId, navigate]);

  useEffect(() => {
    let active = true;
    fetchPublicTransaction(linkId)
      .then((res) => {
        if (!active) return;
        if (!res) setLoadError("invalid");
        else if (new Date(res.link_expires_at).getTime() <= Date.now()) setLoadError("expired");
        else setTxn(res);
      })
      .catch(() => active && setLoadError("error"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [linkId]);

  useEffect(() => {
    if (phase !== "processing") return;
    const id = setInterval(() => setTimer((t) => (t <= 1 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const total = txn ? Number(txn.total_amount) : 0;
  const paid = txn ? Number(txn.paid_amount) : 0;
  const installmentCount = txn?.installment_count;
  const isInstallment = installmentCount && installmentCount > 1;
  const perInstallment = isInstallment ? total / installmentCount : total;
  const currentPayment = isInstallment
    ? paid > 0
      ? Math.floor(paid / perInstallment) + 1
      : 1
    : 1;
  const amountDue = perInstallment;

  async function handlePay() {
    setPhase("processing");
    setFailReason(null);
    setTimer(PROCESSING_TIMEOUT);

    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), PROCESSING_TIMEOUT * 1000);
    });

    try {
      const result = await Promise.race([completePayment(txn.id, amountDue), timeout]);
      navigate(`/pay/${linkId}/receipt`, {
        state: {
          amount: amountDue,
          reference: result?.reference || "—",
          itemName: txn.item_name,
        },
      });
    } catch (err) {
      setFailReason(err?.message === "timeout" ? "timeout" : "failed");
      setPhase("failed");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen max-w-md mx-auto px-5 py-10 animate-pulse">
        <div className="h-8 w-2/3 bg-ink/5 rounded-xl" />
        <div className="h-12 w-full bg-ink/5 rounded-xl mt-8" />
      </div>
    );
  }
  if (loadError === "invalid") return <Message text="This link isn't valid." />;
  if (loadError === "expired")
    return <Message text="This payment link has expired — ask the seller for a new one." />;
  if (loadError === "error")
    return <Message text="Something went wrong loading this transaction." />;

  return (
    <div className="min-h-screen max-w-md mx-auto px-5 py-10 flex flex-col">
      <Link to={`/pay/${linkId}`} className="font-mono text-sm text-yellow-deep hover:text-yellow-text transition-colors">
        ← Back
      </Link>

      <h1 className="font-display text-5xl tracking-wide mt-4 break-words">{txn.item_name}</h1>
      <p className="font-mono text-2xl mt-1">{formatCurrency(total)}</p>

      {isInstallment && (
        <p className="font-mono text-sm text-yellow-text mt-2">
          Payment {currentPayment} of {installmentCount}
        </p>
      )}

      {phase === "ready" && (
        <>
          <Card className="mt-8 p-6 text-center border-2 border-ink/10 bg-ink-soft/20">
            <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Amount due</p>
            <p className="font-display text-5xl mt-2">{formatCurrency(amountDue)}</p>
          </Card>
          <Button type="button" onClick={handlePay} variant="primary" size="xl" className="mt-6 w-full">
            Pay now
          </Button>
        </>
      )}

      {phase === "processing" && (
        <div className="mt-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-full border-4 border-ink border-t-yellow-deep animate-spin" />
          <p className="font-display text-3xl tracking-wide mt-6">Check your phone</p>
          <p className="font-body text-ink/70 mt-2">Enter your PIN to complete payment</p>
          <div className="mt-4 inline-flex items-center gap-2 border-2 border-ink/10 rounded-full px-4 py-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-deep"></span>
            </span>
            <span className="font-mono text-sm text-ink-muted">Expires in {timer}s</span>
          </div>
        </div>
      )}

      {phase === "failed" && (
        <div className="mt-8 space-y-4">
          <Card className="border-danger bg-danger-light p-5">
            <p className="font-body text-danger font-bold text-sm uppercase tracking-wider mb-1">Payment failed</p>
            <p className="font-body text-danger/90 text-sm">
              {failReason === "timeout"
                ? "We didn't get a response in time. Check your phone and try again."
                : "The payment couldn't be completed. Please try again."}
            </p>
          </Card>
          <Button type="button" onClick={handlePay} variant="primary" size="xl" className="w-full">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function Message({ text }) {
  return (
    <div className="min-h-screen max-w-md mx-auto px-5 py-10 flex items-center justify-center">
      <Card className="p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <p className="font-display text-3xl tracking-wide text-ink">{text}</p>
        <Link to="/" className="inline-block mt-5 font-mono text-sm text-yellow-deep hover:underline">
          Go home
        </Link>
      </Card>
    </div>
  );
}

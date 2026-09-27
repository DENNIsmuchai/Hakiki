import { useLocation, useParams, Link } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export default function BuyerReceipt() {
  const { linkId } = useParams();
  const { state } = useLocation();
  const { amount, reference, itemName } = state || {};

  return (
    <div className="min-h-screen max-w-md mx-auto px-5 py-10 flex flex-col items-center text-center">
      <div className="w-20 h-20 mt-6 rounded-full bg-success text-paper flex items-center justify-center text-4xl shadow-hard-sm">
        ✓
      </div>
      <p className="font-display text-5xl tracking-wide mt-6">Payment received</p>
      {itemName && <p className="font-body text-ink-muted mt-2 break-words">{itemName}</p>}

      <Card className="w-full mt-8 p-6 border-2 border-ink/10 text-left space-y-4">
        <div className="flex justify-between font-body">
          <span className="text-ink-muted">Amount paid</span>
          <span className="font-mono font-bold text-success-deep">{amount != null ? formatCurrency(amount) : "—"}</span>
        </div>
        <div className="border-t-2 border-ink/5" />
        <div className="flex justify-between font-body">
          <span className="text-ink-muted">Reference</span>
          <span className="font-mono text-sm break-all">{reference || "—"}</span>
        </div>
        <div className="border-t-2 border-ink/5" />
        <div className="flex justify-between font-body">
          <span className="text-ink-muted">Status</span>
          <span className="font-mono text-sm font-bold text-success-deep uppercase tracking-wider">Completed</span>
        </div>
      </Card>

      <p className="font-body text-ink-muted mt-5 text-sm">
        A receipt has been sent to the seller and buyer.
      </p>

      <Link to={`/pay/${linkId}`} className="mt-8">
        <Button variant="secondary" size="lg">
          Back to item
        </Button>
      </Link>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatPhoneNumber, isValidPhoneNumber, formatCurrency } from "../lib/format";
import { encryptPhone, generateLinkToken } from "../lib/crypto";
import { createTransaction } from "../services/transactions";
import { extractOrder } from "../services/ai";
import { useToast } from "../components/Toast";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

const inputBase =
  "w-full border-2 border-ink rounded-xl px-4 py-3 font-body bg-paper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-yellow-deep focus:ring-2 focus:ring-yellow-light transition-all duration-150";
const smallInput =
  "w-full border-2 border-ink rounded-lg px-3 py-2 font-body text-sm bg-paper text-ink focus:outline-none focus:border-yellow-deep focus:ring-2 focus:ring-yellow-light transition-all duration-150";
const labelBase = "block font-body font-bold mb-2 text-sm uppercase tracking-wider text-ink-muted";
const errorText = "text-danger font-body text-sm mt-1.5";

let itemSeq = 0;
const newItem = (overrides = {}) => ({
  key: `item_${++itemSeq}`,
  name: "",
  quantity: 1,
  unit_price: 0,
  ...overrides,
});

function summarizeItems(items) {
  const named = items.filter((i) => i.name.trim());
  if (named.length === 0) return "Order";
  const first = named[0];
  const label = `${first.name}${first.quantity > 1 ? ` ×${first.quantity}` : ""}`;
  return named.length === 1 ? label : `${label} + ${named.length - 1} more`;
}

function itemizedText(items, deliveryFee) {
  const lines = items
    .filter((i) => i.name.trim())
    .map((i) => `${i.name} × ${i.quantity} — ${formatCurrency(i.unit_price)} each`);
  if (deliveryFee > 0) lines.push(`Delivery — ${formatCurrency(deliveryFee)}`);
  return lines.join("\n");
}

export default function NewTransaction() {
  const navigate = useNavigate();
  const showToast = useToast();

  // "describe" (raw conversational input) -> "review" (structured, editable order)
  const [step, setStep] = useState("describe");
  const [rawText, setRawText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [source, setSource] = useState(null); // "ai" | "heuristic" | "manual" | null

  const [items, setItems] = useState([newItem()]);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [buyerPhone, setBuyerPhone] = useState("");

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(() => {
    const itemsTotal = items.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
      0
    );
    return itemsTotal + (Number(deliveryFee) || 0);
  }, [items, deliveryFee]);

  async function handleExtract() {
    if (!rawText.trim()) {
      setExtractError("Describe the order first — e.g. \"2 black hoodies at 1500 each, delivery to Westlands is 300\".");
      return;
    }
    setExtracting(true);
    setExtractError(null);
    try {
      const result = await extractOrder(rawText);
      const extractedItems = (result.items || []).map((i) =>
        newItem({ name: i.name, quantity: i.quantity, unit_price: i.unit_price })
      );
      setItems(extractedItems.length > 0 ? extractedItems : [newItem()]);
      setDeliveryFee(String(result.delivery_fee ?? 0));
      setSource(result.source || "ai");
      setStep("review");
    } catch (err) {
      setExtractError(err?.message || "Couldn't read that order — try rephrasing or enter it manually.");
    } finally {
      setExtracting(false);
    }
  }

  function skipToManual() {
    setItems([newItem()]);
    setDeliveryFee("0");
    setSource("manual");
    setStep("review");
  }

  function updateItem(key, field, value) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  }

  function removeItem(key) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function validate() {
    const next = {};
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) next.items = "Add at least one item with a name.";
    items.forEach((i) => {
      if (i.name.trim() && (!Number.isFinite(Number(i.unit_price)) || Number(i.unit_price) < 0)) {
        next.items = "Every item needs a valid price (0 or more).";
      }
      if (i.name.trim() && (!Number.isInteger(Number(i.quantity)) || Number(i.quantity) < 1)) {
        next.items = "Every item needs a quantity of 1 or more.";
      }
    });
    if (!buyerPhone.trim()) {
      next.buyerPhone = "Buyer phone number is required.";
    } else if (!isValidPhoneNumber(buyerPhone)) {
      next.buyerPhone = "Use a Kenyan number: 07XXXXXXXX or +254XXXXXXXXX.";
    }
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const cleanItems = items
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
      }));
    const fee = Number(deliveryFee) || 0;

    const normalizedPhone = formatPhoneNumber(buyerPhone);
    const last4 = normalizedPhone.replace(/\D/g, "").slice(-4);
    const linkToken = generateLinkToken();
    const linkExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      item_name: summarizeItems(items),
      item_description: itemizedText(items, fee),
      item_photo_url: null,
      items: cleanItems,
      delivery_fee: fee,
      total_amount: total,
      raw_order_text: rawText.trim() || null,
      ai_extracted: source === "ai",
      buyer_phone_encrypted: encryptPhone(normalizedPhone),
      buyer_phone_last4: last4,
      link_token: linkToken,
      link_expires_at: linkExpiresAt,
    };

    setSubmitting(true);
    try {
      const row = await createTransaction(payload);
      showToast("Link created — share it with your buyer");
      navigate(`/seller/transaction/${row.id}`);
    } catch (err) {
      setSubmitError(err?.message || "Something went wrong creating the transaction. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="mb-8">
          <h1 className="font-display text-5xl md:text-6xl tracking-wide">New Transaction</h1>
          <p className="font-body text-ink-muted mt-2 text-lg">
            From conversation to verified transaction.
          </p>
        </div>

        {step === "describe" && (
          <Card className="p-6 md:p-8">
            <label className={labelBase} htmlFor="rawText">
              Describe the order, the way it came in
            </label>
            <textarea
              id="rawText"
              rows={5}
              className={inputBase}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder='e.g. "Brian wants 2 black hoodies at 1500 each and a cap for 300, delivery to Westlands is 300"'
            />
            {extractError && <p className={errorText}>{extractError}</p>}

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleExtract}
                disabled={extracting}
              >
                {extracting ? "Reading order…" : "Extract order"}
              </Button>
              <Button type="button" variant="ghost" size="lg" onClick={skipToManual} disabled={extracting}>
                Enter items manually
              </Button>
            </div>
            <p className="font-body text-ink-muted text-xs mt-4">
              You'll review and can edit every item before anything is created — nothing is charged
              or sent automatically.
            </p>
          </Card>
        )}

        {step === "review" && (
          <Card className="p-6 md:p-8">
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {submitError && (
                <div className="border-2 border-danger bg-danger-light text-danger font-body rounded-xl p-4">
                  {submitError}
                </div>
              )}

              {source && source !== "manual" && (
                <div className="border-2 border-yellow-deep/20 bg-yellow-light rounded-xl p-4">
                  <p className="font-body text-sm text-yellow-text">
                    {source === "ai"
                      ? "AI-extracted from your description — check every line before confirming."
                      : "Extracted locally (AI isn't configured) — check every line before confirming."}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelBase} style={{ marginBottom: 0 }}>
                    Items <span className="text-yellow-deep">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep("describe")}
                    className="font-mono text-xs text-yellow-deep hover:underline"
                  >
                    ← Edit description
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.key} className="flex gap-2 items-start">
                      <input
                        type="text"
                        className={`${smallInput} flex-[3]`}
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateItem(item.key, "name", e.target.value)}
                      />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className={`${smallInput} flex-1`}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.key, "quantity", e.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={`${smallInput} flex-[1.4]`}
                        placeholder="Unit price"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.key, "unit_price", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="shrink-0 h-[38px] w-[38px] rounded-lg border-2 border-ink/10 text-ink-muted hover:border-danger hover:text-danger transition-colors"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {errors.items && <p className={errorText}>{errors.items}</p>}

                <button
                  type="button"
                  onClick={() => setItems((prev) => [...prev, newItem()])}
                  className="mt-3 font-mono text-xs text-yellow-deep hover:underline"
                >
                  + Add item
                </button>
              </div>

              {/* Delivery fee */}
              <div>
                <label className={labelBase} htmlFor="deliveryFee">
                  Delivery fee (KES)
                </label>
                <input
                  id="deliveryFee"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputBase} max-w-[12rem]`}
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
              </div>

              {/* Item photo */}
              <div>
                <label className={labelBase} htmlFor="photo">
                  Photo (optional)
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  className={`${inputBase} file:mr-3 file:border-0 file:bg-yellow file:text-ink file:font-bold file:px-4 file:py-2 file:rounded-lg cursor-pointer`}
                  onChange={handlePhotoChange}
                />
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Item preview"
                    className="mt-4 w-32 h-32 object-cover rounded-xl border-2 border-ink/10"
                  />
                )}
              </div>

              {/* Buyer phone */}
              <div>
                <label className={labelBase} htmlFor="buyerPhone">
                  Buyer phone number <span className="text-yellow-deep">*</span>
                </label>
                <input
                  id="buyerPhone"
                  type="tel"
                  className={`${inputBase} ${errors.buyerPhone ? "border-danger ring-danger-light" : ""}`}
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="07XXXXXXXX or +254XXXXXXXXX"
                />
                {errors.buyerPhone && <p className={errorText}>{errors.buyerPhone}</p>}
              </div>

              {/* Total */}
              <div className="border-2 border-ink/10 rounded-xl p-5 bg-ink-soft/30 flex items-center justify-between">
                <span className="font-body font-bold text-sm uppercase tracking-wider text-ink-muted">
                  Total
                </span>
                <span className="font-mono text-2xl font-semibold">{formatCurrency(total)}</span>
              </div>

              <Button type="submit" variant="primary" size="xl" className="w-full" disabled={submitting}>
                {submitting ? "Creating link…" : "Create payment link"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

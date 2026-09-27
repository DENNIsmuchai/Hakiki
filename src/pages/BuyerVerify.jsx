import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency, isValidPhoneNumber } from "../lib/format";
import {
  fetchPublicTransaction,
  verifyPhoneMatch,
  requestOtp,
  markBuyerVerified,
  verifyBuyer,
} from "../services/buyer";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN = 60;

function formatDuration(sec) {
  if (sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function BuyerVerify() {
  const { linkId } = useParams();
  const navigate = useNavigate();

  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(null);
  const [rateMsg, setRateMsg] = useState(null);

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState(null);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  const inputs = useRef([]);

  useEffect(() => {
    let active = true;
    fetchPublicTransaction(linkId)
      .then((res) => {
        if (!active) return;
        if (!res) setLoadError("invalid");
        else if (res.status === "cancelled") setLoadError("cancelled");
        else if (new Date(res.link_expires_at).getTime() <= Date.now()) setLoadError("expired");
        else setTxn(res);
      })
      .catch(() => active && setLoadError("error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [linkId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    setPhoneError(null);
    setRateMsg(null);
    if (!isValidPhoneNumber(phone)) {
      setPhoneError("Enter a Kenyan number: 07XXXXXXXX or +254XXXXXXXXX.");
      return;
    }
    setBusy(true);
    try {
      const matchRes = await verifyPhoneMatch(txn.id, phone);
      if (!matchRes.match) {
        setPhoneError("We couldn't verify this number for this link.");
        return;
      }
      const otpRes = await requestOtp(txn.id, phone);
      if (!otpRes.ok) {
        setRateMsg(`Too many attempts — try again in ${formatDuration(otpRes.retryAfterSeconds)}.`);
        return;
      }
      setCooldown(RESEND_COOLDOWN);
      setStep("otp");
    } catch (err) {
      setPhoneError(err?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function setDigit(i, raw) {
    const v = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
  }

  function onOtpKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function onOtpPaste(e) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    const next = Array(OTP_LENGTH).fill("");
    for (let k = 0; k < text.length; k++) next[k] = text[k];
    setDigits(next);
    inputs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    setOtpError(null);
    const code = digits.join("");
    if (code.length < OTP_LENGTH) {
      setOtpError("Enter all 6 digits.");
      return;
    }
    setBusy(true);
    try {
      const res = await verifyBuyer(phone, code);
      if (!res.verified) {
        const next = otpAttempts + 1;
        setOtpAttempts(next);
        if (next >= MAX_OTP_ATTEMPTS) {
          setStep("locked");
        } else {
          setOtpError("That code is incorrect.");
        }
        return;
      }
      await markBuyerVerified(txn.id);
      sessionStorage.setItem(`hakiki_verified_${linkId}`, "1");
      navigate(`/pay/${linkId}/pay`);
    } catch (err) {
      setOtpError(err?.message || "Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setOtpError(null);
    const otpRes = await requestOtp(txn.id, phone);
    if (!otpRes.ok) {
      setRateMsg(`Too many attempts — try again in ${formatDuration(otpRes.retryAfterSeconds)}.`);
      return;
    }
    setDigits(Array(OTP_LENGTH).fill(""));
    setOtpAttempts(0);
    setCooldown(RESEND_COOLDOWN);
    inputs.current[0]?.focus();
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
  if (loadError === "cancelled")
    return <Message text="This transaction was cancelled by the seller." />;
  if (loadError === "expired")
    return (
      <Message text="This payment link has expired — ask the seller for a new one." />
    );
  if (loadError === "error")
    return <Message text="Something went wrong loading this transaction." />;

  const total = Number(txn.total_amount);

  return (
    <div className="min-h-screen max-w-md mx-auto px-5 py-10 flex flex-col">
      <Link to={`/pay/${linkId}`} className="font-mono text-sm text-yellow-deep hover:underline">
        ← Back
      </Link>

      <h1 className="font-display text-5xl tracking-wide mt-4 break-words">{txn.item_name}</h1>
      <p className="font-mono text-2xl mt-1">{formatCurrency(total)}</p>

      {(phoneError || rateMsg) && (
        <Card className="mt-5 border-danger bg-danger-light">
          <p className="font-body text-danger text-sm">{phoneError || rateMsg}</p>
        </Card>
      )}

      {step === "phone" && (
        <form onSubmit={handlePhoneSubmit} noValidate className="mt-8 space-y-5">
          <p className="font-body text-ink-muted">
            Confirm your phone number to continue.
          </p>
          <input
            type="tel"
            className="w-full border-2 border-ink rounded-xl px-4 py-3.5 font-body bg-paper focus:outline-none focus:border-yellow-deep focus:ring-2 focus:ring-yellow-light transition-all"
            placeholder="07XXXXXXXX or +254XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleOtpSubmit} noValidate className="mt-8 space-y-5">
          <p className="font-body text-ink-muted">
            Enter the {OTP_LENGTH}-digit code we sent to your phone.
          </p>
          <div className="flex justify-between gap-2" onPaste={onOtpPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onOtpKeyDown(i, e)}
                className="w-12 h-14 text-center font-mono text-2xl border-2 border-ink rounded-xl bg-paper focus:outline-none focus:border-yellow-deep focus:ring-2 focus:ring-yellow-light transition-all"
              />
            ))}
          </div>

          {otpError && (
            <Card className="border-danger bg-danger-light">
              <p className="font-body text-danger text-sm">{otpError}</p>
            </Card>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? "Verifying…" : "Verify"}
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="w-full font-body font-bold text-yellow-deep disabled:text-ink-muted transition-colors"
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}

      {step === "locked" && (
        <Message text="Too many incorrect codes — ask the seller for a new link." />
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
      </Card>
    </div>
  );
}

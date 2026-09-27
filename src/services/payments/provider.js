// =============================================================================
// PAYMENT PROVIDER ABSTRACTION (FR5)
// =============================================================================
// The rest of the app never talks to a specific payment API directly — it
// only calls getPaymentProvider() (or the flat helpers below). That means a
// real provider can be dropped in later without touching buyer.js or any
// page.
//
//   PaymentProvider
//         │
//         ├── MockProvider      (used today — no external API required)
//         ├── MpesaProvider     (future)
//         └── FutureProvider    (future)
// =============================================================================

class PaymentProvider {
  async sendOtp(_phoneNumber) {
    throw new Error("sendOtp() not implemented");
  }
  async verifyBuyer(_phoneNumber, _otpCode) {
    throw new Error("verifyBuyer() not implemented");
  }
  async chargePayment(_transactionId, _amount) {
    throw new Error("chargePayment() not implemented");
  }
}

function randomId(prefix, length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}_${out}`;
}

// ---------------------------------------------------------------------------
// MockProvider — sandbox provider for the prototype. No network calls, no API
// keys required. Every OTP of 4+ characters is accepted, and every charge
// "succeeds" instantly. This keeps Hakiki fully demoable without pretending
// to have a real payment integration it doesn't have (see FR5).
// ---------------------------------------------------------------------------
class MockProvider extends PaymentProvider {
  async sendOtp(_phoneNumber) {
    return { sent: true };
  }

  async verifyBuyer(_phoneNumber, otpCode) {
    const verified = typeof otpCode === "string" && otpCode.trim().length >= 4;
    return { verified };
  }

  async chargePayment(_transactionId, _amount) {
    return {
      paymentId: randomId("pay", 18),
      status: "captured",
      reference: randomId("ref", 10),
    };
  }
}

const activeProvider = new MockProvider();

// Swap this out (e.g. `new MpesaProvider()`) once a real provider is wired up
// — nothing else in the app needs to change.
export function getPaymentProvider() {
  return activeProvider;
}

// Flat convenience exports so callers don't need to instantiate anything.
export const sendOtp = (phone) => getPaymentProvider().sendOtp(phone);
export const verifyBuyer = (phone, otp) => getPaymentProvider().verifyBuyer(phone, otp);
export const chargePayment = (transactionId, amount) =>
  getPaymentProvider().chargePayment(transactionId, amount);

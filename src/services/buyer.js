import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { sendOtp, verifyBuyer, chargePayment } from "./payments/provider";
import { encryptPhone } from "../lib/crypto";
import { findCreatedById, findCreatedByToken } from "./mockStore";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEMO_PHONES = {
  "hakiki-demo": "0712345678",
  "hakiki-partial": "0798765432",
  "hakiki-expired": "0700112233",
  "hakiki-cancelled": "0722334455",
};

function normalizePhone(phone) {
  const d = String(phone).replace(/\D/g, "");
  if (d.startsWith("0")) return "254" + d.slice(1);
  if (d.startsWith("254")) return d;
  return d;
}

const MOCK = {
  "hakiki-demo": {
    id: "txn-demo",
    item_name: "iPhone 13, 128GB",
    item_description: "Unlocked, 128GB, 89% battery health. Comes with original box, charger, and cable. Face ID works perfectly. No scratches on screen.",
    item_photo_url: "https://picsum.photos/seed/hakiki-buyer/400",
    total_amount: 3000,
    status: "awaiting_verification",
    link_expires_at: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    transaction_hash: null,
    paid_amount: 0,
    buyer_phone_encrypted: encryptPhone(DEMO_PHONES["hakiki-demo"]),
    seller_name: "John Kamau",
    seller_phone: "0712345678",
    seller_location: "Nairobi, CBD",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  "hakiki-partial": {
    id: "txn-partial",
    item_name: "Vintage camera",
    item_description: "Film camera, fully working. Perfect for collectors or photography enthusiasts.",
    item_photo_url: null,
    total_amount: 5000,
    status: "partially_paid",
    installment_count: 3,
    link_expires_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    transaction_hash: null,
    paid_amount: 2000,
    buyer_phone_encrypted: encryptPhone(DEMO_PHONES["hakiki-partial"]),
    seller_name: "Amina Wanjiku",
    seller_phone: "0723456789",
    seller_location: "Mombasa, Nyali",
    created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  "hakiki-expired": {
    id: "txn-expired",
    item_name: "Mountain bike",
    item_description: "27.5 inch, good condition. Recently serviced with new brakes and tires.",
    item_photo_url: null,
    total_amount: 12000,
    status: "partially_paid",
    link_expires_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    transaction_hash: null,
    paid_amount: 4000,
    buyer_phone_encrypted: encryptPhone(DEMO_PHONES["hakiki-expired"]),
    seller_name: "David Ochieng",
    seller_phone: "0734567890",
    seller_location: "Kisumu, Milimani",
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  "hakiki-cancelled": {
    id: "txn-cancelled",
    item_name: "Gaming console",
    item_description: "Disk edition. Includes 2 controllers and 5 games.",
    item_photo_url: null,
    total_amount: 38000,
    status: "cancelled",
    link_expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    transaction_hash: null,
    paid_amount: 0,
    buyer_phone_encrypted: encryptPhone(DEMO_PHONES["hakiki-cancelled"]),
    seller_name: "Sarah Njeri",
    seller_phone: "0745678901",
    seller_location: "Nakuru, Lanet",
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
};

const mockTxnByToken = (token) => MOCK[token] || null;
const mockTxnById = (id) => Object.values(MOCK).find((t) => t.id === id) || null;

export async function fetchPublicTransaction(linkId) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(600);
    return findCreatedByToken(linkId) || mockTxnByToken(linkId);
  }
  const { data, error } = await supabase.rpc("get_public_transaction_by_token", {
    token: linkId,
  });
  if (error) throw error;
  return data;
}

export async function verifyPhoneMatch(transactionId, enteredPhone) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(500);
    const txn = findCreatedById(transactionId) || mockTxnById(transactionId);
    if (!txn) return { match: false };
    const stored = atob(txn.buyer_phone_encrypted);
    return { match: normalizePhone(stored) === normalizePhone(enteredPhone) };
  }
  const { data, error } = await supabase.functions.invoke("verify-phone-match", {
    body: { transactionId, enteredPhone },
  });
  if (error) throw error;
  return data;
}

const otpSends = {};

export async function requestOtp(transactionId, phone) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(500);
    const now = Date.now();
    const window = 10 * 60 * 1000;
    const recent = (otpSends[transactionId] || []).filter((ts) => now - ts < window);
    if (recent.length >= 3) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.ceil((window - (now - oldest)) / 1000);
      return { ok: false, retryAfterSeconds };
    }
    recent.push(now);
    otpSends[transactionId] = recent;
    await sendOtp(phone);
    return { ok: true };
  }
  const { data, error } = await supabase.functions.invoke("send-otp", {
    body: { transactionId, phone },
  });
  if (error) throw error;
  return data;
}

export async function markBuyerVerified(transactionId) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(400);
    return { ok: true };
  }
  const { error } = await supabase
    .from("transactions")
    .update({ buyer_verified: true, buyer_verified_at: new Date().toISOString() })
    .eq("id", transactionId);
  if (error) throw error;
  return { ok: true };
}

export async function completePayment(transactionId, amount) {
  const charge = await chargePayment(transactionId, amount);

  if (!isSupabaseConfigured || !supabase) {
    await delay(400);
    return { ok: true, reference: charge.reference };
  }

  const { data, error } = await supabase.functions.invoke("complete-payment", {
    body: {
      transactionId,
      amount,
      loopReferenceId: charge.reference,
      paymentId: charge.paymentId,
    },
  });
  if (error) throw error;
  return data;
}

export { verifyBuyer };

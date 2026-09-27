import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { generateLinkToken } from "../lib/crypto";
import { mockCreatedTransactions, addCreatedTransaction, findCreatedById } from "./mockStore";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- mock dataset (shared by dashboard + detail for demoability) ----
const NOW = Date.now();
const hours = (h) => new Date(NOW + h * 3600 * 1000).toISOString();
const ago = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

const MOCK_TRANSACTIONS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    item_name: "iPhone 13, 128GB",
    item_photo_url: "https://picsum.photos/seed/hakiki-iphone/200",
    item_description: "Unlocked, 128GB, 89% battery health. Comes with box.",
    total_amount: 3000,
    buyer_phone_last4: "4821",
    buyer_verified: true,
    buyer_verified_at: ago(1),
    status: "partially_paid",
    link_token: "pay_demo_1111",
    link_expires_at: hours(5),
    transaction_hash: "0x9f2c4ab7e1d3c8a6f0b5e2d9c4a7b1e3f6d8c0a2",
    blockchain_tx_id: null,
    created_at: ago(2),
    seller_name: "John Kamau",
    seller_phone: "0712345678",
    seller_location: "Nairobi, CBD",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    item_name: 'Samsung TV 55"',
    item_photo_url: null,
    item_description: "QLED 4K, wall mount included.",
    total_amount: 25000,
    buyer_phone_last4: "7730",
    buyer_verified: true,
    buyer_verified_at: ago(25),
    status: "fully_paid",
    link_token: "pay_demo_2222",
    link_expires_at: hours(20),
    transaction_hash: "0x1a3b5c7d9e2f4a6b8c0d1e3f5a7b9c2d4e6f8a0b",
    blockchain_tx_id: null,
    created_at: ago(26),
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    item_name: "Sneakers (UK 9)",
    item_photo_url: null,
    item_description: "Worn twice, excellent condition.",
    total_amount: 3500,
    buyer_phone_last4: "1190",
    buyer_verified: false,
    buyer_verified_at: null,
    status: "awaiting_verification",
    link_token: "pay_demo_3333",
    link_expires_at: hours(0.83),
    transaction_hash: null,
    blockchain_tx_id: null,
    created_at: ago(0.5),
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    item_name: "Vintage jacket",
    item_photo_url: null,
    item_description: "Leather, 80s style.",
    total_amount: 1800,
    buyer_phone_last4: "6654",
    buyer_verified: false,
    buyer_verified_at: null,
    status: "awaiting_verification",
    link_token: "pay_demo_4444",
    link_expires_at: hours(3),
    transaction_hash: null,
    blockchain_tx_id: null,
    created_at: ago(5),
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    item_name: "Gaming chair",
    item_photo_url: null,
    item_description: "Ergonomic, missing one caster.",
    total_amount: 9000,
    buyer_phone_last4: "2210",
    buyer_verified: false,
    buyer_verified_at: null,
    status: "expired",
    link_token: "pay_demo_5555",
    link_expires_at: hours(-3),
    transaction_hash: null,
    blockchain_tx_id: null,
    created_at: ago(50),
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    item_name: "AirPods Pro",
    item_photo_url: null,
    item_description: "Gen 2, with case.",
    total_amount: 22000,
    buyer_phone_last4: "9043",
    buyer_verified: true,
    buyer_verified_at: ago(7),
    status: "cancelled",
    link_token: "pay_demo_6666",
    link_expires_at: hours(12),
    transaction_hash: null,
    blockchain_tx_id: null,
    created_at: ago(8),
  },
];

const MOCK_PAYMENTS = [
  {
    id: "p1",
    transaction_id: "11111111-1111-1111-1111-111111111111",
    amount: 1500,
    loop_reference_id: "LOOP-REF-0001",
    status: "completed",
    created_at: ago(1.5),
  },
  {
    id: "p2",
    transaction_id: "22222222-2222-2222-2222-222222222222",
    amount: 25000,
    loop_reference_id: "LOOP-REF-0002",
    status: "completed",
    created_at: ago(24),
  },
];

const findMock = (id) => findCreatedById(id) || MOCK_TRANSACTIONS.find((t) => t.id === id) || null;
const mockPaymentsFor = (id) =>
  MOCK_PAYMENTS.filter((p) => p.transaction_id === id)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------
export async function createTransaction(input) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(600);
    const row = {
      id: crypto.randomUUID(),
      status: "awaiting_verification",
      paid_amount: 0,
      transaction_hash: null,
      ...input,
    };
    addCreatedTransaction(row);
    return row;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to create a transaction.");

  const { data, error } = await supabase
    .from("transactions")
    .insert({ seller_id: user.id, status: "awaiting_verification", ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// fetchDashboard
// ---------------------------------------------------------------------------
export async function fetchDashboard() {
  if (!isSupabaseConfigured || !supabase) {
    await delay(700);
    return {
      transactions: [...mockCreatedTransactions, ...MOCK_TRANSACTIONS],
      payments: MOCK_PAYMENTS,
    };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to view your dashboard.");

  const { data: transactions, error: txnError } = await supabase
    .from("transactions")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });
  if (txnError) throw txnError;

  const ids = transactions.map((t) => t.id);
  let payments = [];
  if (ids.length > 0) {
    const { data: pays, error: payError } = await supabase
      .from("payments")
      .select("transaction_id, amount, status")
      .in("transaction_id", ids)
      .eq("status", "completed");
    if (payError) throw payError;
    payments = pays;
  }
  return { transactions, payments };
}

// ---------------------------------------------------------------------------
// fetchTransaction — single transaction + its payments, by id
// ---------------------------------------------------------------------------
export async function fetchTransaction(id) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(600);
    const transaction = findMock(id);
    return { transaction, payments: transaction ? mockPaymentsFor(id) : [] };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in.");

  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  let payments = [];
  if (transaction) {
    const { data: pays, error: perr } = await supabase
      .from("payments")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: false });
    if (perr) throw perr;
    payments = pays;
  }
  return { transaction, payments };
}

// ---------------------------------------------------------------------------
// cancelTransaction — sets status to 'cancelled'
// ---------------------------------------------------------------------------
export async function cancelTransaction(id) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(400);
    return { id, status: "cancelled" };
  }
  const { data, error } = await supabase
    .from("transactions")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// regenerateLink — new token + 24h expiry (only meaningful if still owed)
// ---------------------------------------------------------------------------
export async function regenerateLink(id) {
  const link_token = generateLinkToken();
  const link_expires_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  if (!isSupabaseConfigured || !supabase) {
    await delay(400);
    return { id, link_token, link_expires_at };
  }
  const { data, error } = await supabase
    .from("transactions")
    .update({ link_token, link_expires_at })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// verifyTransactionIntegrity — recomputes the tamper-evident hash server-side
// and compares it to the one recorded when the order was settled (FR10).
// ---------------------------------------------------------------------------
export async function verifyTransactionIntegrity(id) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(400);
    return {
      ok: true,
      valid: null,
      note: "Integrity checks run against the live backend once Supabase is configured.",
    };
  }
  const { data, error } = await supabase.functions.invoke("verify-transaction", {
    body: { transactionId: id },
  });
  if (error) throw error;
  return data;
}

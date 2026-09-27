# Hakiki — Migration Guide (v1 → v2)

One-sentence product definition:

> Hakiki is an AI-powered transaction trust layer for social commerce that
> turns conversational orders into verified payments and tamper-evident
> transaction records.

This overhaul keeps your existing React + Vite + Tailwind + Supabase stack —
it did not need to be replaced, it needed the payment/blockchain/AI/anonymity
mixup untangled and the missing pieces (multi-item AI extraction, real hash
anchoring, reconciliation, anomaly detection, seller auth) filled in.

---

## 1. KEEP / MODIFY / DELETE / CREATE

| File | Action | Why |
|---|---|---|
| `src/components/*` | **KEEP** | Design system unchanged |
| `src/pages/Landing.jsx` | **KEEP** | Copy still matches the "trust layer" positioning |
| `src/pages/BuyerVerify.jsx` | **KEEP** | Phone/OTP verification logic unchanged |
| `src/lib/supabase.js`, `src/lib/format.js`, `src/lib/crypto.js` | **KEEP** | No changes needed |
| `supabase/functions/verify-phone-match/index.ts` | **KEEP** | Already correct |
| `src/services/mockStore.js` | **KEEP** | Generic — needs no schema-specific changes |
| `src/services/buyer.js` | **MODIFY** | One import path change (see below) |
| `src/pages/TransactionDetail.jsx` | **MODIFY** | Itemized breakdown, anomaly banner, "Verify integrity" button |
| `src/pages/SellerDashboard.jsx` | **MODIFY** | Anomaly badge on flagged orders |
| `src/pages/BuyerPay.jsx`, `BuyerPayment.jsx`, `BuyerReceipt.jsx` | **UNCHANGED** | They already render from the transaction row generically; no code change required, but they'll now show itemized data if you extend them (optional, not required for MVP) |
| `supabase/functions/complete-payment/index.ts` | **MODIFY** (full rewrite) | Idempotency, reconciliation (FR7), anomaly detection (FR12), hash anchoring (FR10), audit logging (FR8) |
| `supabase/functions/mark-verified/index.ts` | **MODIFY** | Writes an audit event |
| `supabase/schema.sql` | **MODIFY** | New columns + `audit_events` table + updated public RPC |
| `App.jsx`, `main.jsx`, `src/components/Navbar.jsx` | **MODIFY** | Wired in auth routes/guard |
| `src/pages/NewTransaction.jsx` | **REWRITE** | Two-step AI order composer (FR1/FR2) |
| `src/services/loop.js` | **DELETE** | Replaced by `src/services/payments/provider.js` |
| `src/services/payments/provider.js` | **CREATE** | `PaymentProvider` interface + `MockProvider` (FR5) |
| `src/services/ai.js` | **CREATE** | Client-side AI extraction + heuristic fallback |
| `supabase/functions/extract-order/index.ts` | **CREATE** | Server-side AI order extraction (FR2) |
| `supabase/functions/verify-transaction/index.ts` | **CREATE** | Recomputes + compares the tamper-evident hash (FR10) |
| `supabase/functions/_shared/hash.ts` | **CREATE** | Canonical hash logic shared by the two functions above |
| `src/lib/authContext.jsx` | **CREATE** | Session context + `RequireAuth` guard |
| `src/pages/Auth.jsx` | **CREATE** | Seller sign in / sign up (email + password) |

**Not implemented** (explicitly out of scope for this pass — flagged so it's a decision, not an oversight):
- A real blockchain testnet integration. The "blockchain" step is simulated:
  a real SHA-256 hash of the transaction record is computed and stored, with
  a mock `blockchain_tx_id` (`MOCKCHAIN-...`) standing in for an on-chain
  transaction ID. Swapping in a real testnet later means writing to it inside
  `_shared/hash.ts` — everything that calls it stays the same.
- Real AES-256 phone number encryption — `src/lib/crypto.js` already had this
  as a stub before this overhaul; it wasn't touched, so it's stubbed exactly
  as it was.
- A real M-Pesa/Loop payment integration — `MockProvider` is deliberately the
  only implementation, per FR5.

---

## 2. New file structure

```
Hakiki/
├── .env.example
├── package.json
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Navbar.jsx            (modified)
│   │   ├── Toast.jsx
│   │   └── Wordmark.jsx
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── format.js
│   │   ├── crypto.js
│   │   └── authContext.jsx       (new)
│   ├── services/
│   │   ├── transactions.js       (modified)
│   │   ├── buyer.js              (modified)
│   │   ├── ai.js                 (new)
│   │   ├── mockStore.js
│   │   └── payments/
│   │       └── provider.js       (new — replaces loop.js)
│   └── pages/
│       ├── Landing.jsx
│       ├── Auth.jsx              (new)
│       ├── SellerDashboard.jsx   (modified)
│       ├── NewTransaction.jsx    (rewritten)
│       ├── TransactionDetail.jsx (modified)
│       ├── BuyerPay.jsx
│       ├── BuyerVerify.jsx
│       ├── BuyerPayment.jsx
│       └── BuyerReceipt.jsx
└── supabase/
    ├── schema.sql                (modified)
    └── functions/
        ├── _shared/
        │   └── hash.ts           (new)
        ├── extract-order/        (new)
        │   └── index.ts
        ├── complete-payment/     (rewritten)
        │   └── index.ts
        ├── verify-transaction/   (new)
        │   └── index.ts
        ├── verify-phone-match/
        │   └── index.ts
        └── mark-verified/        (modified)
            └── index.ts
```

---

## 3. Setup steps (Windows, VS Code terminal)

### 3.1 Swap in the new code
Unzip the delivered `Hakiki-v2.zip` and copy its contents over your existing
project folder (or open it as a fresh folder in VS Code — either works, since
this *is* your project with the changes above applied).

```powershell
cd path\to\Hakiki
npm install
```

No new npm dependencies were added — `provider.js` and `ai.js` use only
`fetch` and the browser's native `crypto`, and the Edge Functions use Deno's
built-in `crypto.subtle`. This was a deliberate choice to keep the stack
minimal.

### 3.2 Decide: local/mock mode, or a real Supabase backend?

**Mock mode (fastest — no setup):** if `.env.local` doesn't exist or has no
`VITE_SUPABASE_URL`, the whole app — including AI extraction, which falls
back to a local heuristic parser — runs entirely in the browser against
`localStorage`. Good for demoing the UX before wiring up a backend.

```powershell
npm run dev
```

**Real backend:** continue to 3.3.

### 3.3 Apply the database schema

In the Supabase dashboard → SQL Editor, paste and run the full contents of
`supabase/schema.sql`. It's written to be safe to re-run on an existing
database (uses `if not exists` / `add column if not exists` throughout), so
if you already had the old schema applied, running this again upgrades it in
place — you won't lose existing transactions or payments.

### 3.4 Install the Supabase CLI and log in (if you haven't already)

```powershell
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
```

### 3.5 Deploy the Edge Functions

```powershell
supabase functions deploy extract-order
supabase functions deploy complete-payment
supabase functions deploy verify-transaction
supabase functions deploy verify-phone-match
supabase functions deploy mark-verified
```

### 3.6 Set secrets

```powershell
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
you don't set those. If you skip this step entirely, `extract-order` returns
`ok:false` and the client silently falls back to the heuristic parser — AI
extraction is a convenience, never a hard dependency.

### 3.7 Configure the client

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never put `ANTHROPIC_API_KEY` in this file — it's a server-side secret and
belongs only in Supabase's function secrets (3.6).

### 3.8 Enable email auth (for the new Auth page)

In the Supabase dashboard → Authentication → Providers, make sure Email is
enabled. For a hackathon demo, you may also want to turn off "Confirm email"
under Authentication → Settings, so `supabase.auth.signUp` logs the seller in
immediately without waiting on an email round-trip.

### 3.9 Run it

```powershell
npm run dev
```

Sign up a seller account at `/auth`, then you're in the dashboard.

---

## 4. Testing checklist (maps to the requirements doc)

- [ ] **FR1/FR2** — On `/seller/new`, paste `"2 black hoodies at 1500 each and a cap for 300, delivery to Westlands is 300"` → Extract → confirm the 2 items + delivery fee appear correctly, editable.
- [ ] **FR2 fallback** — Temporarily unset `ANTHROPIC_API_KEY` (or just test in mock mode) → extraction still works via the heuristic parser.
- [ ] **FR3/FR4** — Create the order → open the generated `/pay/:linkId` link in a private window → order details render, amount is not editable via the URL.
- [ ] **FR5** — Complete a payment; confirm no real payment API is called (Mock provider only).
- [ ] **FR6/FR7** — Pay the full amount → transaction flips to `fully_paid`. Then, using the browser console or a second tab, try calling `complete-payment` again with the *same* `loopReferenceId` → confirm it returns `{ ok: true, duplicate: true }` and does not double-count.
- [ ] **FR7/FR12 mismatch** — Manually invoke `complete-payment` with an `amount` larger than the remaining balance → transaction should show `payment_mismatch: true` and the anomaly banner should appear on `TransactionDetail`, without blocking the order.
- [ ] **FR8** — Query `audit_events` for a transaction ID in the Supabase table editor → confirm rows for `payment_verified`, `buyer_verified`, and (if fully paid) `hash_recorded`.
- [ ] **FR9** — After an order is `fully_paid`, revisit the same payment link → it should show as already paid, not accept another charge (`complete-payment` returns 409 "already fully paid").
- [ ] **FR10** — Once fully paid, open `TransactionDetail` → the Blockchain proof card shows a hash → click "Verify integrity" → should report a match.
- [ ] **FR11** — Confirm the dashboard reflects `fully_paid` immediately after payment (simulated notification via dashboard state, as specified for the prototype).
- [ ] **FR12** — See the FR7/FR12 mismatch test above.
- [ ] **Auth** — Sign out, confirm `/seller`, `/seller/new`, and `/seller/transaction/:id` redirect to `/auth`. Sign back in, confirm you land back on the dashboard.

---

## 5. What to say in the demo

> "A merchant just gets a WhatsApp order like this —" *(show the raw text)*
> "— and Hakiki reads it, they confirm it, and from that point every order,
> payment, and verification event is tied together and hashed. If anything
> about that record changes later, this button" *(click Verify integrity)*
> "tells you immediately."

That's the FR1→FR10 story end-to-end in about 30 seconds.

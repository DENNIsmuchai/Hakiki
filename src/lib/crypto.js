// =============================================================================
// PHONE ENCRYPTION — PLACEHOLDER, NOT SECURE.
// encryptPhone() currently only base64-encodes the plaintext. This is a stub.
//
// ⚠️ BEFORE THIS CODE TOUCHES ANY REAL DATA, replace encryptPhone() with real
//    AES-256-GCM encryption (e.g. Web Crypto SubtleCrypto AES-GCM, or — better —
//    encrypt server-side with a KMS / Supabase Vault key). The key must NEVER
//    be exposed to the browser. The stored value is `buyer_phone_encrypted`,
//    and only the last 4 digits are kept in plaintext for display.
// =============================================================================

export function encryptPhone(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) return "";
  // base64 of the UTF-8 string — placeholder only.
  return btoa(unescape(encodeURIComponent(plaintext)));
}

// =============================================================================
// LINK TOKEN — cryptographically random, opaque for now.
// Uses the Web Crypto API's randomUUID(). The shape is intentionally just a
// raw UUID so it can later be swapped for a *signed JWT* (e.g. { txnId, exp }
// signed with JWT_SECRET) without changing any caller — callers only depend on
// the returned string, so the internals can change freely.
// =============================================================================

export function generateLinkToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Non-crypto fallback — should never run in a modern browser.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Shared store for transactions created during an unconfigured (mock) session.
// Backed by localStorage so a created link remains openable by the buyer even
// across a full page reload / new tab (mirrors a real backend in dev). In
// production this whole module is bypassed — createTransaction talks to Supabase.
const STORAGE_KEY = "hakiki_mock_transactions";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export const mockCreatedTransactions = load();

export function addCreatedTransaction(row) {
  mockCreatedTransactions.push(row);
  save(mockCreatedTransactions);
}

export function findCreatedById(id) {
  return mockCreatedTransactions.find((t) => t.id === id) || null;
}

export function findCreatedByToken(token) {
  return mockCreatedTransactions.find((t) => t.link_token === token) || null;
}

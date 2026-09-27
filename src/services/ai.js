import { supabase, isSupabaseConfigured } from "../lib/supabase";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Heuristic fallback extractor — used whenever the extract-order Edge
// Function isn't reachable or ANTHROPIC_API_KEY isn't configured, so the
// order composer keeps working in local/demo mode (never a hard dependency).
// Turns something like "2 black hoodies at 1500 each, cap 300, delivery to
// Westlands is 300" into a structured order. It's a regex, not a language
// model — good enough for the demo path, not as capable as the AI path.
// ---------------------------------------------------------------------------
function heuristicExtract(rawText) {
  const text = rawText.trim();
  let deliveryFee = 0;

  const deliveryMatch = text.match(/delivery[^0-9]{0,20}(\d+(\.\d+)?)/i);
  if (deliveryMatch) deliveryFee = parseFloat(deliveryMatch[1]);

  const withoutDelivery = text.replace(/[^.,]*delivery[^.,]*/gi, "");
  const chunks = withoutDelivery
    .split(/,| and /i)
    .map((c) => c.trim())
    .filter(Boolean);

  const items = [];
  for (const chunk of chunks) {
    const qtyMatch = chunk.match(/^(\d+)\s*x?\s*/i) || chunk.match(/x\s*(\d+)/i);
    const priceMatch = chunk.match(/(?:at|@|for)?\s*(?:kes|ksh)?\s*(\d+(\.\d+)?)\s*(each)?\s*$/i);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    const unitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

    let name = chunk
      .replace(/^(\d+)\s*x?\s*/i, "")
      .replace(/x\s*\d+/i, "")
      .replace(/(?:at|@|for)?\s*(?:kes|ksh)?\s*\d+(\.\d+)?\s*(each)?\s*$/i, "")
      .trim();
    if (!name) name = chunk.trim();
    if (name) items.push({ name, quantity: quantity || 1, unit_price: unitPrice || 0 });
  }

  if (items.length === 0) {
    items.push({ name: text.slice(0, 60) || "Item", quantity: 1, unit_price: 0 });
  }

  return {
    items,
    delivery_fee: deliveryFee,
    customer_name: null,
    notes: null,
    source: "heuristic",
  };
}

// ---------------------------------------------------------------------------
// extractOrder — turns a conversational order description into
// { items: [{name, quantity, unit_price}], delivery_fee, customer_name, notes }.
//
// The merchant MUST review and confirm this before a transaction is created —
// Hakiki never creates a transaction directly from AI output (FR2, AI safety).
// ---------------------------------------------------------------------------
export async function extractOrder(rawText) {
  if (!isSupabaseConfigured || !supabase) {
    await delay(500);
    return heuristicExtract(rawText);
  }

  try {
    const { data, error } = await supabase.functions.invoke("extract-order", {
      body: { text: rawText },
    });
    if (error || !data || data.ok === false) {
      return heuristicExtract(rawText);
    }
    return { ...data.result, source: data.engine ||"ai" };
  } catch {
    // AI extraction is a convenience, never a hard dependency.
    return heuristicExtract(rawText);
  }
}

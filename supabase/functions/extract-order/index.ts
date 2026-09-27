// Supabase Edge Function: extract-order
//
// Engine order: self-hosted model on Brev (free/your credits) -> Gemini
// (free tier) -> Anthropic (paid, last resort) -> client-side heuristic.
// Each engine is skipped if its secret isn't set, and failures fall through
// silently — nothing here is a hard dependency for the rest of the app.
import { corsHeaders } from "../_shared/cors.ts";
const BREV_INFERENCE_URL = Deno.env.get("BREV_INFERENCE_URL");
const BREV_API_KEY = Deno.env.get("BREV_API_KEY");
const BREV_MODEL = Deno.env.get("BREV_MODEL") || "llama3.1:8b";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `You extract structured order data from informal, conversational messages sent by social-commerce sellers in Kenya (e.g. from WhatsApp/Instagram chats).

Return ONLY a JSON object, no prose, no markdown fences, matching exactly:
{
  "items": [ { "name": string, "quantity": number, "unit_price": number } ],
  "delivery_fee": number,
  "customer_name": string | null,
  "notes": string | null
}

Rules:
- Amounts are in Kenyan Shillings (KES). Strip currency words/symbols.
- If a price isn't mentioned for an item, set unit_price to 0.
- If quantity isn't mentioned, use 1.
- delivery_fee is 0 if not mentioned.
- Never invent items, prices, or a customer name that weren't stated.
- customer_name is only the buyer's name, never the seller's.`;

type EngineResult = { ok: true; text: string } | { ok: false; error: string };

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAiCompatible(
  url: string,
  apiKey: string | undefined,
  model: string,
  text: string,
  label: string
): Promise<EngineResult> {
  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text.slice(0, 2000) },
        ],
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `${label} error: ${(await response.text()).slice(0, 200)}` };
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { ok: false, error: `Unexpected response shape from ${label}.` };
    }
    return { ok: true, text: content };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}

async function callBrev(text: string): Promise<EngineResult> {
  if (!BREV_INFERENCE_URL) return { ok: false, error: "Brev endpoint not configured." };
  return callOpenAiCompatible(`${BREV_INFERENCE_URL}/v1/chat/completions`, BREV_API_KEY, BREV_MODEL, text, "Brev");
}

async function callGemini(text: string): Promise<EngineResult> {
  if (!GEMINI_API_KEY) return { ok: false, error: "Gemini API key not configured." };
  return callOpenAiCompatible(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    GEMINI_API_KEY,
    GEMINI_MODEL,
    text,
    "Gemini"
  );
}

async function callAnthropic(text: string): Promise<EngineResult> {
  if (!ANTHROPIC_API_KEY) return { ok: false, error: "Anthropic API key not configured." };
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text.slice(0, 2000) }],
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Anthropic error: ${(await response.text()).slice(0, 200)}` };
    }
    const data = await response.json();
    const textBlock = (data.content || []).find((c: any) => c.type === "text");
    if (!textBlock) return { ok: false, error: "No text content in Anthropic response." };
    return { ok: true, text: textBlock.text };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}

function safeParseJson(text: string) {
  const cleaned = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function validateResult(result: any) {
  if (!result || !Array.isArray(result.items)) return null;
  const items = result.items
    .filter((i: any) => i && typeof i.name === "string" && i.name.trim())
    .map((i: any) => ({
      name: String(i.name).slice(0, 200),
      quantity: Number.isFinite(Number(i.quantity)) && Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      unit_price: Number.isFinite(Number(i.unit_price)) && Number(i.unit_price) >= 0 ? Number(i.unit_price) : 0,
    }));
  if (items.length === 0) return null;
  return {
    items,
    delivery_fee: Number.isFinite(Number(result.delivery_fee)) && Number(result.delivery_fee) >= 0 ? Number(result.delivery_fee) : 0,
    customer_name: typeof result.customer_name === "string" ? result.customer_name.slice(0, 100) : null,
    notes: typeof result.notes === "string" ? result.notes.slice(0, 500) : null,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
    }
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return json({ ok: false, error: "No order text provided." }, 400);
    }

    const engines: Array<[string, () => Promise<EngineResult>]> = [
      ["brev", () => callBrev(text)],
      ["gemini", () => callGemini(text)],
      ["anthropic", () => callAnthropic(text)],
    ];

    let engine = "";
    let result: EngineResult = { ok: false, error: "No engines configured." };
    for (const [name, call] of engines) {
      result = await call();
      engine = name;
      if (result.ok) break;
    }

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 400);
    }

    const validated = validateResult(safeParseJson(result.text));
    if (!validated) {
      return json({ ok: false, error: "Could not extract a structured order from that text." }, 400);
    }

    return json({ ok: true, result: validated, engine });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
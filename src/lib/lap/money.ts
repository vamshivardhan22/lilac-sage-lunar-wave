import type { Asked } from "./types.ts";

export type MoneyKind = "loan" | "market";

export interface MoneyHit {
  value: number;
  index: number;
  kind: MoneyKind | "unknown";
}

const WORD_VALUES: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const UNIT: Record<string, number> = {
  crore: 10_000_000,
  crores: 10_000_000,
  cr: 10_000_000,
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  lacs: 100_000,
};

const NUM_WORD =
  "(?:seventy[\\s-]?five|sixty[\\s-]?five|fifty[\\s-]?five|forty[\\s-]?five|thirty[\\s-]?five|twenty[\\s-]?five|ninety[\\s-]?five|eighty[\\s-]?five|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ninety|eighty|seventy|sixty|fifty|forty|thirty|twenty|ten|nine|eight|seven|six|five|four|three|two|one|\\d+(?:\\.\\d+)?)";

function wordToNumber(raw: string): number | null {
  const t = raw.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  if (WORD_VALUES[t] != null) return WORD_VALUES[t];
  const bits = t.split(" ");
  if (
    bits.length === 2 &&
    WORD_VALUES[bits[0]] != null &&
    WORD_VALUES[bits[0]] >= 20 &&
    WORD_VALUES[bits[1]] != null &&
    WORD_VALUES[bits[1]] < 10
  ) {
    return WORD_VALUES[bits[0]] + WORD_VALUES[bits[1]];
  }
  return null;
}

export function formatINR(amount: number): string {
  if (amount >= 10_000_000) {
    const cr = Math.round((amount / 10_000_000) * 100) / 100;
    return `₹${cr} crore`;
  }
  if (amount >= 100_000) {
    const lk = Math.round((amount / 100_000) * 100) / 100;
    return `₹${lk} lakh`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

function maskIncomeAndYears(text: string): string {
  let t = text;
  t = t.replace(
    /\b(earn|earns|earning|salary of|income of|i make|makes)\b[^.]{0,48}?((?:₹|rs\.?\s*)?\d[\d,]*(?:\.\d+)?(?:\s*(?:lakh|lakhs|lac|lacs|crore|crores|cr))?)/gi,
    (m) => m.replace(/\d/g, "#"),
  );
  t = t.replace(
    /((?:₹|rs\.?\s*)?\d[\d,]*(?:\.\d+)?(?:\s*(?:lakh|lakhs|lac|lacs|crore|crores|cr))?)\s*(?:a|per)\s*(?:month|annum|year)/gi,
    (m) => m.replace(/\d/g, "#"),
  );
  t = t.replace(
    new RegExp(`\\b${NUM_WORD}\\s*[- ]?(?:years|year|yrs|yr|saal)\\b`, "gi"),
    (m) => " ".repeat(m.length),
  );
  t = t.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, (m) => " ".repeat(m.length));
  t = t.replace(/\b\d+(?:\.\d+)?\s*(?:%|percent)\b/gi, (m) => " ".repeat(m.length));
  return t;
}

interface Span {
  value: number;
  index: number;
  end: number;
}

function collectSpans(text: string): Span[] {
  const spans: Span[] = [];
  const unitRe = new RegExp(
    `\\b(?:(a|an)\\s+|(${NUM_WORD})\\s*)(crores?|lakhs?|lacs?|cr)\\b`,
    "gi",
  );
  for (const m of text.matchAll(unitRe)) {
    const n = m[1] ? 1 : wordToNumber(m[2] ?? "");
    const unit = UNIT[m[3].toLowerCase()];
    if (n == null || !unit) continue;
    spans.push({ value: Math.round(n * unit), index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  const commaRe = /\b\d{1,3}(?:,\d{2})+(?:,\d{3})?\b|\b\d{1,3}(?:,\d{3})+\b/g;
  for (const m of text.matchAll(commaRe)) {
    const value = Number(m[0].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    spans.push({ value, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  const bigRe = /(?:₹|rs\.?\s*)(\d{5,})(?!\d)/gi;
  for (const m of text.matchAll(bigRe)) {
    spans.push({
      value: Number(m[1]),
      index: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  spans.sort((a, b) => a.index - b.index || b.end - a.end);
  const kept: Span[] = [];
  for (const span of spans) {
    const overlap = kept.some((k) => span.index < k.end && span.end > k.index);
    if (!overlap) kept.push(span);
  }
  return kept;
}

function classify(text: string, index: number, asked: Asked): MoneyKind | "unknown" {
  const before = text.slice(Math.max(0, index - 70), index).toLowerCase();
  const loanCue = /\b(need|borrow|loan|looking|want|require|chahiye|lena|take|around)\b/.test(before);
  const marketCue = /\b(worth|value|valued|market|costs|costing|price|priced|approx)/.test(before);
  if (marketCue && !loanCue) return "market";
  if (loanCue && !marketCue) return "loan";
  if (marketCue && loanCue) {
    const marketAt = Math.max(
      before.lastIndexOf("worth"),
      before.lastIndexOf("value"),
      before.lastIndexOf("market"),
      before.lastIndexOf("price"),
    );
    const loanAt = Math.max(
      before.lastIndexOf("need"),
      before.lastIndexOf("borrow"),
      before.lastIndexOf("loan"),
      before.lastIndexOf("want"),
      before.lastIndexOf("looking"),
    );
    return marketAt > loanAt ? "market" : "loan";
  }
  if (asked === "loan_amount" || asked === "loan_cap") return "loan";
  if (asked === "market_value") return "market";
  return "unknown";
}

function bareLakhs(text: string, asked: Asked): Span | null {
  if (asked !== "loan_amount" && asked !== "loan_cap" && asked !== "market_value") return null;
  const re = new RegExp(`\\b(${NUM_WORD})\\b(?!\\s*(?:years|year|yrs|yr|saal|%|percent|am|pm))`, "gi");
  const hits: Span[] = [];
  for (const m of text.matchAll(re)) {
    const n = wordToNumber(m[1]);
    if (n == null || n < 5 || n > 300) continue;
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
    if (/^\s*(?:lakh|lac|crore|cr|year)/i.test(after)) continue;
    hits.push({
      value: Math.round(n * 100_000),
      index: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  return hits.length ? hits[hits.length - 1] : null;
}

export function findMoney(original: string, asked: Asked): MoneyHit[] {
  const masked = maskIncomeAndYears(original);
  const spans = collectSpans(masked);
  const hits: MoneyHit[] = spans.map((span) => ({
    value: span.value,
    index: span.index,
    kind: classify(original, span.index, asked),
  }));
  const bare = bareLakhs(masked, asked === "loan_amount" || asked === "loan_cap" || asked === "market_value" || spans.length > 0 ? asked === "market_value" && spans.length === 0 ? "market_value" : spans.length > 0 && asked !== "market_value" ? "loan_amount" : asked : "verify");
  if (bare && !spans.some((s) => bare.index < s.end && bare.end > s.index)) {
    hits.push({ value: bare.value, index: bare.index, kind: classify(original, bare.index, asked) });
  }
  return hits.filter((h) => h.value > 0).sort((a, b) => a.index - b.index);
}

export function pickLoan(hits: MoneyHit[], utterance: string): number | null {
  const loans = hits.filter((h) => h.kind === "loan");
  if (!loans.length) return null;
  const accepted =
    /\b(but|instead|fine|okay|ok|proceed|works|maximum|settle|chalega|theek|thik|i can do|i'll take|i will take|let's do|lets do)\b/i.test(
      utterance,
    );
  const over = loans.some((h) => h.value > 7_500_000);
  const under = loans.filter((h) => h.value <= 7_500_000);
  if (over && under.length && accepted) return under[under.length - 1].value;
  return loans[loans.length - 1].value;
}

export function pickMarket(hits: MoneyHit[]): number | null {
  const markets = hits.filter((h) => h.kind === "market");
  if (!markets.length) return null;
  return markets[markets.length - 1].value;
}

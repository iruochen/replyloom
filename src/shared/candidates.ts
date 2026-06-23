import type { ReplyCandidate } from "./types";

const genericOpeners = /^(great post|well said|thanks for sharing|interesting post|好文|说得好|感谢分享)[!,.，。\s]*/i;

export function parseCandidates(payload: unknown): ReplyCandidate[] {
  const parsed = normalizePayload(payload);
  if (!parsed) {
    throw new Error("The provider response did not contain a candidates array.");
  }

  const seen = new Set<string>();
  const candidates = parsed.candidates
    .map((item: unknown, index: number) => normalizeCandidate(item, index))
    .filter((item): item is ReplyCandidate => Boolean(item))
    .filter((item) => {
      const key = item.text.toLocaleLowerCase().replace(/[\s\p{P}]/gu, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (candidates.length < 3) {
    throw new Error("The provider returned fewer than three distinct replies.");
  }
  return candidates.slice(0, 3);
}

function normalizePayload(payload: unknown): { candidates: unknown[] } | null {
  if (Array.isArray(payload)) return { candidates: payload };
  if (typeof payload === "object" && payload !== null) return candidateContainer(payload);
  if (typeof payload !== "string") return null;

  const withoutThinking = payload.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const withoutFence = (fenced ?? withoutThinking).trim();
  try {
    return candidateContainer(JSON.parse(withoutFence));
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const extracted = candidateContainer(JSON.parse(withoutFence.slice(start, end + 1)));
        if (extracted) return extracted;
      } catch {
        // Fall through to the plain-text list parser.
      }
    }
    const list = plainTextCandidates(withoutFence);
    return list.length >= 3 ? { candidates: list } : null;
  }
}

function candidateContainer(value: unknown): { candidates: unknown[] } | null {
  if (Array.isArray(value)) return { candidates: value };
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["candidates", "replies", "results", "data"]) {
    if (Array.isArray(record[key])) return { candidates: record[key] as unknown[] };
    if (typeof record[key] === "object" && record[key] !== null) {
      const values = Object.values(record[key] as Record<string, unknown>);
      if (values.length >= 3) return { candidates: values };
    }
    if (typeof record[key] === "string") {
      try {
        const nested = candidateContainer(JSON.parse(record[key]));
        if (nested) return nested;
      } catch {
        const list = plainTextCandidates(record[key] as string);
        if (list.length >= 3) return { candidates: list };
      }
    }
  }
  const replyEntries = Object.entries(record).filter(([key, item]) => /^(?:reply|candidate|回复|候选)[_\s-]*\d+$/i.test(key) && (typeof item === "string" || typeof item === "object"));
  if (replyEntries.length >= 3) return { candidates: replyEntries.map(([, item]) => item) };
  for (const nested of Object.values(record)) {
    if (typeof nested !== "object" || nested === null) continue;
    const found = candidateContainer(nested);
    if (found) return found;
  }
  return null;
}

function plainTextCandidates(value: string) {
  const quoted = [...value.matchAll(/["“]([^"”\n]{4,280})["”]/g)]
    .map((match) => match[1].trim())
    .filter((item) => !/^(?:candidates|text|angle|reply|replies)$/i.test(item));
  if (quoted.length >= 3) return quoted.slice(-6);
  const expanded = value
    .replace(/\s+(?=(?:\d+[.)、]|[-•]|(?:回复|候选)[一二三123][:：])\s*)/g, "\n")
    .replace(/\s*[；;]\s*/g, "\n");
  return expanded.split(/\n+/)
    .map((line) => line.trim().replace(/^(?:(?:\d+[.)、])|[-*•]|(?:回复|候选)[一二三123][:：])\s*/, ""))
    .filter((line) => line.length > 0 && !/^(?:replies|candidates|候选|回复)[:：]?$/i.test(line))
    .slice(0, 6);
}

function normalizeCandidate(item: unknown, index: number): ReplyCandidate | null {
  const record = typeof item === "object" && item !== null ? item as Record<string, unknown> : null;
  const rawText = typeof item === "string" ? item : String(record?.text ?? record?.reply ?? record?.content ?? "");
  const text = rawText.trim().replace(genericOpeners, "").trim();
  if (!text) return null;
  const angle = record?.angle ? String(record.angle) : undefined;
  return { id: `${Date.now()}-${index}`, text, angle };
}

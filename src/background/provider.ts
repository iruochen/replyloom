import { parseCandidates } from "../shared/candidates";
import { naturalizeCandidateText } from "../shared/naturalize";
import { buildReplyPrompt } from "../shared/prompts";
import { PROVIDER_DEFAULTS, type ConnectionResult, type GenerationSettings, type PostContext, type ProviderConfig, type ReplyCandidate } from "../shared/types";

const REQUEST_TIMEOUT_MS = 30_000;

export async function testProvider(config: ProviderConfig): Promise<ConnectionResult> {
  validateConfig(config);
  const result = await requestChat(config, [
    { role: "system", content: "Return only the word OK." },
    { role: "user", content: "Connection test" },
  ], 4);
  return { ok: /ok/i.test(result) || result.length > 0, message: `Connected to ${config.model}.` };
}

export async function listModels(config: ProviderConfig): Promise<string[]> {
  validateConfig(config, false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/models`;

  try {
    await assertHostPermission(endpoint);
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as {
      data?: Array<{ id?: string } | string>;
      models?: Array<{ id?: string; name?: string } | string>;
      error?: { message?: string };
    } | null;

    if (!response.ok) throwProviderResponse(response.status, payload?.error?.message);
    const entries = (payload?.data ?? payload?.models) as Array<{ id?: string; name?: string } | string> | undefined;
    const models = Array.isArray(entries)
      ? entries.map((item) => typeof item === "string" ? item : item.id ?? item.name ?? "").filter(Boolean)
      : [];
    if (!models.length) throw new ProviderError("INVALID_RESPONSE", "The provider did not return a model list. You can still enter a model name manually.");
    return [...new Set(models)].sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ProviderError("TIMEOUT", "Loading models took longer than 30 seconds.");
    throw await networkError(error, endpoint, "The model list request failed.");
  } finally {
    clearTimeout(timer);
  }
}

export async function generateReplies(config: ProviderConfig, post: PostContext, settings: GenerationSettings): Promise<ReplyCandidate[]> {
  validateConfig(config);
  const prompt = buildReplyPrompt(post, settings);
  const languageHint = inferReplyLanguage(post, settings);
  const outputBudget = config.preset === "minimax"
    ? (settings.length === "short" ? 2048 : 3072)
    : (settings.length === "short" ? 500 : 800);
  const content = await requestChat(config, [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ], outputBudget, true);
  try {
    return naturalizeCandidates(parseCandidates(content), languageHint);
  } catch {
    const repaired = await requestChat(config, [
      { role: "system", content: "Convert the supplied draft replies into valid JSON only. Do not add commentary." },
      { role: "user", content: `Return exactly this shape with three distinct items: {"candidates":[{"text":"...","angle":"..."},{"text":"...","angle":"..."},{"text":"...","angle":"..."}]}\n\nDraft response:\n${content}` },
    ], config.preset === "minimax" ? 2048 : 600, true);
    try {
      return naturalizeCandidates(parseCandidates(repaired), languageHint);
    } catch {
      throw new ProviderError("INVALID_RESPONSE", `The model returned an incomplete or unsupported reply format (${repaired.length} characters). Retry once; if it persists, choose a non-reasoning model.`);
    }
  }
}

function naturalizeCandidates(candidates: ReplyCandidate[], languageHint: "zh" | "en") {
  return candidates.map((candidate) => ({
    ...candidate,
    text: naturalizeCandidateText(candidate.text, languageHint),
  }));
}

function inferReplyLanguage(post: PostContext, settings: GenerationSettings): "zh" | "en" {
  if (settings.language === "zh") return "zh";
  if (settings.language === "en") return "en";
  return post.language?.startsWith("zh") || /[\u3400-\u9fff]/.test(post.text) ? "zh" : "en";
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

async function requestChat(config: ProviderConfig, messages: ChatMessage[], maxTokens: number, jsonMode = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  try {
    await assertHostPermission(endpoint);
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: jsonMode ? 0.7 : 0,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    };
    const send = () => fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      cache: "no-store",
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    let response = await send();
    let payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
      error?: { message?: string };
    } | null;

    if (response.status === 400 && "response_format" in requestBody) {
      delete requestBody.response_format;
      response = await send();
      payload = await response.json().catch(() => null) as typeof payload;
    }

    if (!response.ok) {
      const detail = payload?.error?.message?.slice(0, 240);
      throwProviderResponse(response.status, detail);
    }

    const content = payload?.choices?.[0]?.message?.content;
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => part.text ?? "").join("")
        : "";
    if (!text.trim()) throw new ProviderError("INVALID_RESPONSE", "The provider returned an empty response.");
    return text;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ProviderError("TIMEOUT", "The provider took longer than 30 seconds. Try again.");
    throw await networkError(error, endpoint, "The provider request failed.");
  } finally {
    clearTimeout(timer);
  }
}

async function assertHostPermission(endpoint: string) {
  if (typeof chrome === "undefined" || !chrome.permissions?.contains) return;
  const originPattern = `${new URL(endpoint).origin}/*`;
  const allowed = await chrome.permissions.contains({ origins: [originPattern] });
  if (!allowed) {
    throw new ProviderError("PERMISSION", `Chrome has not granted ReplyLoom access to ${new URL(endpoint).origin}. Open Settings and approve the site permission again.`);
  }
}

async function networkError(error: unknown, endpoint: string, fallback: string) {
  const original = error instanceof Error ? error.message : fallback;
  const origin = new URL(endpoint).origin;
  let permission = "unknown";
  if (typeof chrome !== "undefined" && chrome.permissions?.contains) {
    permission = await chrome.permissions.contains({ origins: [`${origin}/*`] }) ? "granted" : "missing";
  }
  const hint = /failed to fetch|networkerror|load failed/i.test(original)
    ? `No HTTP response was received from ${origin} (Chrome host permission: ${permission}). Check DNS, proxy/VPN, firewall, or regional network access.`
    : original;
  return new ProviderError("PROVIDER", hint);
}

function validateConfig(config: ProviderConfig, requireModel = true) {
  if (!config.baseUrl.trim() || (requireModel && !config.model.trim()) || !config.apiKey.trim()) {
    throw new ProviderError("NO_PROVIDER", "Add a provider endpoint, model, and API key in Settings.");
  }
  const url = new URL(config.baseUrl);
  const allowedUrl = new URL(PROVIDER_DEFAULTS[config.preset].baseUrl);
  if (url.protocol !== "https:" || url.search || url.hash || url.origin !== allowedUrl.origin || trimTrailingSlash(url.pathname) !== trimTrailingSlash(allowedUrl.pathname)) {
    throw new ProviderError("PERMISSION", "Use the official endpoint supplied by ReplyLoom for this provider.");
  }
}

function trimTrailingSlash(pathname: string) {
  return pathname.replace(/\/+$/, "");
}

function throwProviderResponse(status: number, detail?: string): never {
  const safeDetail = detail?.slice(0, 240);
  if (status === 401 || status === 403) throw new ProviderError("AUTH", safeDetail || "The provider rejected the API key.");
  if (status === 429) throw new ProviderError("RATE_LIMIT", safeDetail || "The provider rate limit or quota was reached.");
  throw new ProviderError("PROVIDER", safeDetail || `Provider request failed with status ${status}.`);
}

export class ProviderError extends Error {
  constructor(public readonly code: "NO_PROVIDER" | "PERMISSION" | "AUTH" | "RATE_LIMIT" | "TIMEOUT" | "PROVIDER" | "INVALID_RESPONSE", message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

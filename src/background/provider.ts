import { parseCandidates } from "../shared/candidates";
import { naturalizeCandidateText } from "../shared/naturalize";
import { buildReplyPrompt } from "../shared/prompts";
import { PROVIDER_DEFAULTS, type ConnectionResult, type GenerationSettings, type PostContext, type ProviderConfig, type ReplyCandidate } from "../shared/types";

const MODEL_LIST_TIMEOUT_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const PRIMARY_GENERATION_TIMEOUT_MS = 18_000;
const RETRY_GENERATION_TIMEOUT_MS = 12_000;

export async function testProvider(config: ProviderConfig): Promise<ConnectionResult> {
  validateConfig(config);
  const result = await requestChat(config, [
    { role: "system", content: "Return only the word OK. Do not include reasoning or extra text." },
    { role: "user", content: "Connection test" },
  ], 32, { allowReasoningOnly: true });
  return { ok: /ok/i.test(result) || result.length > 0, message: `Connected to ${config.model}.` };
}

export async function listModels(config: ProviderConfig): Promise<string[]> {
  validateConfig(config, false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS);
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
    if (error instanceof DOMException && error.name === "AbortError") throw new ProviderError("TIMEOUT", "Loading models took longer than 15 seconds.");
    throw await networkError(error, endpoint, "The model list request failed.");
  } finally {
    clearTimeout(timer);
  }
}

export async function generateReplies(config: ProviderConfig, post: PostContext, settings: GenerationSettings): Promise<ReplyCandidate[]> {
  validateConfig(config);
  const prompt = buildReplyPrompt(post, settings);
  const languageHint = inferReplyLanguage(post, settings);
  const outputBudget = primaryOutputBudget(config, settings);
  const retryBudget = retryOutputBudget(settings);
  let content = "";

  try {
    content = await requestChat(config, [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ], outputBudget, { jsonMode: true, timeoutMs: PRIMARY_GENERATION_TIMEOUT_MS });
    return naturalizeCandidates(parseCandidates(content), languageHint);
  } catch (error) {
    if (!(error instanceof ProviderError) || (error.code !== "TIMEOUT" && error.code !== "INVALID_RESPONSE")) {
      throw error;
    }
  }

  try {
    const repaired = await requestChat(config, buildCompactRetryMessages(post, settings), retryBudget, {
      jsonMode: false,
      timeoutMs: RETRY_GENERATION_TIMEOUT_MS,
    });
    try {
      return naturalizeCandidates(parseCandidates(repaired), languageHint);
    } catch {
      throw new ProviderError("INVALID_RESPONSE", `The model returned an incomplete or unsupported reply format (${repaired.length} characters). Retry once; if it persists, choose a non-reasoning model.`);
    }
  } catch (error) {
    if (error instanceof ProviderError && error.code === "TIMEOUT") {
      throw new ProviderError("TIMEOUT", "The provider stayed slow after a fast retry. Try a shorter post, a faster model, or generate again.");
    }
    throw error;
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

interface RequestChatOptions {
  jsonMode?: boolean;
  timeoutMs?: number;
  allowReasoningOnly?: boolean;
}

async function requestChat(config: ProviderConfig, messages: ChatMessage[], maxTokens: number, options: RequestChatOptions = {}) {
  const { jsonMode = false, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, allowReasoningOnly = false } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const isMiniMax = config.preset === "minimax";

  try {
    await assertHostPermission(endpoint);
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: jsonMode ? 0.7 : 0,
      max_tokens: maxTokens,
      ...(jsonMode && !isMiniMax ? { response_format: { type: "json_object" } } : {}),
      ...(isMiniMax ? { reasoning_split: true } : {}),
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
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }>; reasoning_content?: string } }>;
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
    const reasoningContent = payload?.choices?.[0]?.message?.reasoning_content ?? "";
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => part.text ?? "").join("")
        : "";
    if (!text.trim() && allowReasoningOnly && reasoningContent.trim()) {
      return reasoningContent;
    }
    if (!text.trim()) throw new ProviderError("INVALID_RESPONSE", "The provider returned an empty response.");
    return text;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (isAbortError(error, controller.signal)) throw new ProviderError("TIMEOUT", `The provider took longer than ${Math.round(timeoutMs / 1000)} seconds. Try again.`);
    throw await networkError(error, endpoint, "The provider request failed.");
  } finally {
    clearTimeout(timer);
  }
}

function primaryOutputBudget(config: ProviderConfig, settings: GenerationSettings) {
  if (config.preset === "minimax") return settings.length === "short" ? 768 : 1024;
  return settings.length === "short" ? 320 : 520;
}

function retryOutputBudget(settings: GenerationSettings) {
  return settings.length === "short" ? 220 : 320;
}

function isAbortError(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /aborted|aborterror/i.test(message);
}

function buildCompactRetryMessages(post: PostContext, settings: GenerationSettings): ChatMessage[] {
  const prefersChinese = settings.language === "zh" || (settings.language === "auto" && (post.language?.startsWith("zh") || /[\u3400-\u9fff]/.test(post.text)));
  const languageLine = prefersChinese ? "Use natural Chinese." : "Use natural English.";
  const lengthLine = settings.length === "short"
    ? (prefersChinese ? "Keep each reply under 45 Chinese characters." : "Keep each reply under 110 characters.")
    : (prefersChinese ? "Keep each reply under 90 Chinese characters." : "Keep each reply under 180 characters.");

  return [
    {
      role: "system",
      content: `Write exactly three distinct X replies.
- No intro, no commentary, no JSON.
- Output exactly three lines.
- Each line must be a complete reply draft.
- Sound human, specific, and non-generic.`,
    },
    {
      role: "user",
      content: `${languageLine}
${lengthLine}
Style: ${settings.style}
Voice: ${settings.voiceProfile.trim() || (prefersChinese ? "自然、像真人在 X 上说话。" : "Natural and conversational.")}
Additional instruction: ${settings.customInstruction.trim() || "None."}

Post:
${post.text}`,
    },
  ];
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

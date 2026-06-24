import { sendRuntimeMessage } from "../shared/messages";
import { DEFAULT_APP_PREFERENCES, PROVIDER_DEFAULTS, type AppPreferences, type ConnectionResult, type GenerationSettings, type PostContext, type ProviderConfig, type ProviderProfiles, type ReplyCandidate } from "../shared/types";

const hasExtensionRuntime = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
const previewPost: PostContext = {
  url: "https://x.com/example/status/123",
  authorName: "Lena",
  authorHandle: "@lena_builds",
  text: "The best AI products may not feel like AI products at all. They simply remove one annoying step from a workflow.",
  language: "en",
  extractedAt: Date.now(),
};

export function getState() {
  if (!hasExtensionRuntime) return Promise.resolve({ post: previewPost });
  return sendRuntimeMessage<{ post: PostContext | null }>({ type: "GET_STATE" });
}

export function extractActivePost() {
  if (!hasExtensionRuntime) return Promise.resolve(previewPost);
  return sendRuntimeMessage<PostContext>({ type: "EXTRACT_ACTIVE_POST" });
}

export function getProviderConfig() {
  if (!hasExtensionRuntime) return Promise.resolve({ ...PROVIDER_DEFAULTS.openai, apiKey: "preview-only", rememberKey: false } satisfies ProviderConfig);
  return sendRuntimeMessage<ProviderConfig>({ type: "GET_PROVIDER_CONFIG" });
}

export function getProviderProfiles() {
  if (!hasExtensionRuntime) return Promise.resolve(PROVIDER_DEFAULTS satisfies ProviderProfiles);
  return sendRuntimeMessage<ProviderProfiles>({ type: "GET_PROVIDER_PROFILES" });
}

export function getAppPreferences() {
  if (!hasExtensionRuntime) return Promise.resolve(DEFAULT_APP_PREFERENCES);
  return sendRuntimeMessage<AppPreferences>({ type: "GET_APP_PREFERENCES" });
}

export function saveAppPreferences(preferences: AppPreferences) {
  if (!hasExtensionRuntime) return Promise.resolve(Boolean(preferences));
  return sendRuntimeMessage<boolean>({ type: "SAVE_APP_PREFERENCES", preferences });
}

export function saveProviderConfig(config: ProviderConfig) {
  if (!hasExtensionRuntime) return Promise.resolve(Boolean(config));
  return sendRuntimeMessage<boolean>({ type: "SAVE_PROVIDER_CONFIG", config });
}

export function testProvider(config: ProviderConfig) {
  if (!hasExtensionRuntime) return Promise.resolve({ ok: true, message: `Preview connected to ${config.model}.` });
  return sendRuntimeMessage<ConnectionResult>({ type: "TEST_PROVIDER", config });
}

export function listProviderModels(config: ProviderConfig) {
  if (!hasExtensionRuntime) return Promise.resolve([config.model, "demo-fast-model"].filter(Boolean));
  return sendRuntimeMessage<string[]>({ type: "LIST_PROVIDER_MODELS", config });
}

export function generateReplies(post: PostContext, settings: GenerationSettings) {
  if (!hasExtensionRuntime) return Promise.resolve([
    { id: "preview-1", text: "The best AI experience may be the one that removes a decision instead of adding another interface.", angle: "observation" },
    { id: "preview-2", text: "The real product advantage here is not how visible the AI feels, but how completely the friction disappears.", angle: "implication" },
    { id: "preview-3", text: "What signal would tell you that this annoying step has genuinely disappeared for users?", angle: settings.style },
  ] satisfies ReplyCandidate[]);
  return sendRuntimeMessage<ReplyCandidate[]>({ type: "GENERATE_REPLIES", post, settings });
}

export function insertDraft(postUrl: string, text: string) {
  if (!hasExtensionRuntime) return Promise.resolve(Boolean(postUrl && text));
  return sendRuntimeMessage<boolean>({ type: "INSERT_DRAFT", postUrl, text });
}

export async function requestProviderPermission(baseUrl: string) {
  if (!hasExtensionRuntime) return Boolean(new URL(baseUrl));
  const url = new URL(baseUrl);
  const originPattern = `${url.origin}/*`;
  if (await chrome.permissions.contains({ origins: [originPattern] })) return true;
  return chrome.permissions.request({ origins: [originPattern] });
}

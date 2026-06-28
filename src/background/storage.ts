import { DEFAULT_APP_PREFERENCES, DEFAULT_PROVIDER_CONFIG, PROVIDER_DEFAULTS, type AppPreferences, type PanelMode, type PostContext, type ProviderConfig, type ProviderPreset, type ProviderProfiles } from "../shared/types";

const PROVIDER_KEY = "providerConfig";
const PROFILES_KEY = "providerProfiles";
const SESSION_KEY = "sessionApiKey";
const SESSION_KEYS_KEY = "sessionApiKeys";
const POST_KEY = "selectedPost";
const PREFERENCES_KEY = "appPreferences";

export async function getProviderConfig(): Promise<ProviderConfig> {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([PROVIDER_KEY, PROFILES_KEY]),
    chrome.storage.session.get([SESSION_KEY, SESSION_KEYS_KEY]),
  ]);
  const stored = local[PROVIDER_KEY] as Partial<ProviderConfig> | undefined;
  const preset = isProviderPreset(stored?.preset) ? stored.preset : DEFAULT_PROVIDER_CONFIG.preset;
  const sessionKeys = session[SESSION_KEYS_KEY] as Partial<Record<ProviderPreset, string>> | undefined;
  return normalizeProviderConfig({
    ...PROVIDER_DEFAULTS[preset],
    ...stored,
    apiKey: stored?.rememberKey === false
      ? String(sessionKeys?.[preset] ?? session[SESSION_KEY] ?? "")
      : String(stored?.apiKey ?? ""),
  });
}

export async function getProviderProfiles(): Promise<ProviderProfiles> {
  const [local, session] = await Promise.all([
    chrome.storage.local.get([PROVIDER_KEY, PROFILES_KEY]),
    chrome.storage.session.get([SESSION_KEY, SESSION_KEYS_KEY]),
  ]);
  const storedProfiles = (local[PROFILES_KEY] ?? {}) as Partial<ProviderProfiles>;
  const legacyActive = local[PROVIDER_KEY] as ProviderConfig | undefined;
  const sessionKeys = (session[SESSION_KEYS_KEY] ?? {}) as Partial<Record<ProviderPreset, string>>;
  const profiles = Object.fromEntries(Object.entries(PROVIDER_DEFAULTS).map(([preset, defaults]) => {
    const key = preset as ProviderPreset;
    const stored = storedProfiles[key] ?? (legacyActive?.preset === key ? legacyActive : undefined);
    const merged = { ...defaults, ...stored, preset: key };
    return [key, normalizeProviderConfig({
      ...merged,
      apiKey: merged.rememberKey === false
        ? String(sessionKeys[key] ?? (legacyActive?.preset === key ? session[SESSION_KEY] ?? "" : ""))
        : String(merged.apiKey ?? ""),
    })];
  }));
  return profiles as ProviderProfiles;
}

export async function saveProviderConfig(config: ProviderConfig) {
  config = normalizeProviderConfig(config);
  const [local, session] = await Promise.all([
    chrome.storage.local.get(PROFILES_KEY),
    chrome.storage.session.get(SESSION_KEYS_KEY),
  ]);
  const profiles = (local[PROFILES_KEY] ?? {}) as Partial<ProviderProfiles>;
  const sessionKeys = (session[SESSION_KEYS_KEY] ?? {}) as Partial<Record<ProviderPreset, string>>;
  const persisted = config.rememberKey ? config : { ...config, apiKey: "" };
  profiles[config.preset] = persisted;
  if (config.rememberKey) delete sessionKeys[config.preset];
  else sessionKeys[config.preset] = config.apiKey;
  await Promise.all([
    chrome.storage.local.set({ [PROVIDER_KEY]: persisted, [PROFILES_KEY]: profiles }),
    chrome.storage.session.set({ [SESSION_KEYS_KEY]: sessionKeys, [SESSION_KEY]: config.rememberKey ? "" : config.apiKey }),
  ]);
}

function normalizeProviderConfig(config: ProviderConfig): ProviderConfig {
  let normalized = config;
  if (config.preset === "minimax" && /^https:\/\/api\.minimax\.com\/v1\/?$/i.test(config.baseUrl.trim())) {
    normalized = { ...normalized, baseUrl: "https://api.minimaxi.com/v1" };
  }
  if (normalized.preset === "minimax") {
    const model = normalized.model.trim();
    if (/^minimax-m?2\.7(?:[-\s]?high[-\s]?speed)$/i.test(model)) {
      normalized = { ...normalized, model: "MiniMax-M2.7-highspeed" };
    }
  }
  return normalized;
}

function isProviderPreset(value: unknown): value is ProviderPreset {
  return typeof value === "string" && value in PROVIDER_DEFAULTS;
}

export async function getAppPreferences(): Promise<AppPreferences> {
  const result = await chrome.storage.local.get(PREFERENCES_KEY);
  return { ...DEFAULT_APP_PREFERENCES, ...(result[PREFERENCES_KEY] as Partial<AppPreferences> | undefined) };
}

export async function saveAppPreferences(preferences: AppPreferences) {
  await chrome.storage.local.set({ [PREFERENCES_KEY]: preferences });
}

export async function getPanelMode(): Promise<PanelMode> {
  return (await getAppPreferences()).panelMode;
}

export async function getSelectedPost(): Promise<PostContext | null> {
  const result = await chrome.storage.session.get(POST_KEY);
  return (result[POST_KEY] as PostContext | undefined) ?? null;
}

export async function saveSelectedPost(post: PostContext) {
  await chrome.storage.session.set({ [POST_KEY]: post });
}

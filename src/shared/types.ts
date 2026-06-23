export type ReplyStyle = "concise" | "insightful" | "humorous" | "supportive" | "question";
export type ReplyLength = "short" | "medium";
export type ReplyLanguage = "auto" | "zh" | "en";
export type ProviderPreset = "openai" | "deepseek" | "minimax" | "glm" | "doubao" | "qwen" | "moonshot" | "siliconflow";
export type UiLanguage = "zh" | "en";
export type PanelMode = "side" | "floating";

export interface PostContext {
  id?: string;
  url: string;
  authorName?: string;
  authorHandle?: string;
  text: string;
  language?: string;
  quotedPost?: Pick<PostContext, "authorName" | "authorHandle" | "text" | "url">;
  extractedAt: number;
}

export interface ProviderConfig {
  preset: ProviderPreset;
  baseUrl: string;
  apiKey: string;
  model: string;
  rememberKey: boolean;
}

export type ProviderProfiles = Record<ProviderPreset, ProviderConfig>;

export interface AppPreferences {
  uiLanguage: UiLanguage;
  panelMode: PanelMode;
}

export interface GenerationSettings {
  style: ReplyStyle;
  length: ReplyLength;
  language: ReplyLanguage;
  customInstruction: string;
  voiceProfile: string;
}

export interface ReplyCandidate {
  id: string;
  text: string;
  angle?: string;
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
}

export type AppErrorCode =
  | "NO_POST"
  | "NO_PROVIDER"
  | "PERMISSION"
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "PROVIDER"
  | "INVALID_RESPONSE"
  | "INSERTION"
  | "UNKNOWN";

export interface AppError {
  code: AppErrorCode;
  message: string;
}

export type RuntimeRequest =
  | { type: "PING" }
  | { type: "GET_STATE" }
  | { type: "EXTRACT_ACTIVE_POST" }
  | { type: "POST_SELECTED"; post: PostContext; panelMode?: PanelMode }
  | { type: "GET_PROVIDER_CONFIG" }
  | { type: "GET_PROVIDER_PROFILES" }
  | { type: "SAVE_PROVIDER_CONFIG"; config: ProviderConfig }
  | { type: "GET_APP_PREFERENCES" }
  | { type: "SAVE_APP_PREFERENCES"; preferences: AppPreferences }
  | { type: "TEST_PROVIDER"; config: ProviderConfig }
  | { type: "LIST_PROVIDER_MODELS"; config: ProviderConfig }
  | { type: "GENERATE_REPLIES"; post: PostContext; settings: GenerationSettings }
  | { type: "INSERT_DRAFT"; postUrl: string; text: string };

export type RuntimeResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export const PROVIDER_DEFAULTS: ProviderProfiles = {
  openai: { preset: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4.1-mini", rememberKey: true },
  deepseek: { preset: "deepseek", baseUrl: "https://api.deepseek.com", apiKey: "", model: "deepseek-v4-flash", rememberKey: true },
  minimax: { preset: "minimax", baseUrl: "https://api.minimaxi.com/v1", apiKey: "", model: "MiniMax-M2.7", rememberKey: true },
  glm: { preset: "glm", baseUrl: "https://open.bigmodel.cn/api/paas/v4", apiKey: "", model: "glm-5.1", rememberKey: true },
  doubao: { preset: "doubao", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", apiKey: "", model: "doubao-seed-2-0-lite-260215", rememberKey: true },
  qwen: { preset: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "", model: "qwen-plus", rememberKey: true },
  moonshot: { preset: "moonshot", baseUrl: "https://api.moonshot.cn/v1", apiKey: "", model: "moonshot-v1-8k", rememberKey: true },
  siliconflow: { preset: "siliconflow", baseUrl: "https://api.siliconflow.cn/v1", apiKey: "", model: "", rememberKey: true },
};

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = { ...PROVIDER_DEFAULTS.openai };

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  uiLanguage: "zh",
  panelMode: "side",
};

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  style: "concise",
  length: "short",
  language: "auto",
  customInstruction: "",
  voiceProfile: "",
};

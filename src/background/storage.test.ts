import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAppPreferences, getProviderConfig, getProviderProfiles, saveProviderConfig } from "./storage";
import type { ProviderConfig } from "../shared/types";

function storageArea(values: Record<string, unknown>) {
  return {
    get: vi.fn(async (keys: string | string[]) => {
      const names = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(names.filter((key) => key in values).map((key) => [key, values[key]]));
    }),
    set: vi.fn(async (update: Record<string, unknown>) => { Object.assign(values, update); }),
    remove: vi.fn(async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; }),
  };
}

describe("provider profile storage", () => {
  beforeEach(() => {
    const local: Record<string, unknown> = {};
    const session: Record<string, unknown> = {};
    vi.stubGlobal("chrome", { storage: { local: storageArea(local), session: storageArea(session) } });
  });

  it("keeps a separate configuration for each provider", async () => {
    const minimax: ProviderConfig = { preset: "minimax", baseUrl: "https://api.minimaxi.com/v1", apiKey: "mini-secret", model: "MiniMax-M2.7", rememberKey: false };
    const openai: ProviderConfig = { preset: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "openai-secret", model: "gpt-test", rememberKey: true };

    await saveProviderConfig(minimax);
    await saveProviderConfig(openai);

    const profiles = await getProviderProfiles();
    expect(profiles.minimax).toEqual(minimax);
    expect(profiles.openai).toEqual(openai);
    expect(await getProviderConfig()).toEqual(openai);
  });

  it("uses the current MiniMax minimaxi.com endpoint by default", async () => {
    expect((await getProviderProfiles()).minimax.baseUrl).toBe("https://api.minimaxi.com/v1");
  });

  it("defaults new installations to the English interface", async () => {
    expect((await getAppPreferences()).uiLanguage).toBe("en");
  });

  it("migrates the previously saved misspelled MiniMax hostname", async () => {
    await saveProviderConfig({ preset: "minimax", baseUrl: "https://api.minimax.com/v1", apiKey: "", model: "MiniMax-M2.7", rememberKey: false });
    expect((await getProviderConfig()).baseUrl).toBe("https://api.minimaxi.com/v1");
  });
});

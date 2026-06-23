import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReplies, listModels, testProvider } from "./provider";
import { DEFAULT_GENERATION_SETTINGS, PROVIDER_DEFAULTS, type PostContext, type ProviderConfig } from "../shared/types";

const config: ProviderConfig = {
  preset: "openai",
  baseUrl: "https://api.openai.com/v1/",
  apiKey: "secret-test-key",
  model: "test-model",
  rememberKey: false,
};

const post: PostContext = {
  url: "https://x.com/example/status/1",
  text: "Small models make local-first products much more interesting.",
  extractedAt: 1,
};

afterEach(() => vi.unstubAllGlobals());

describe("provider adapter", () => {
  it("calls an OpenAI-compatible endpoint and parses replies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ candidates: [
        { text: "The privacy benefit may matter more than raw speed." },
        { text: "Which workloads already fit comfortably on-device?" },
        { text: "Local-first gets compelling when offline stops feeling like a fallback." },
      ] }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateReplies(config, post, DEFAULT_GENERATION_SETTINGS);
    expect(result).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer secret-test-key");
  });

  it("requests JSON mode and a reasoning-safe budget for MiniMax", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ candidates: ["回复一", "回复二", "回复三"] }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await generateReplies({ ...config, preset: "minimax", baseUrl: "https://api.minimaxi.com/v1" }, post, DEFAULT_GENERATION_SETTINGS);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.max_tokens).toBe(2048);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("normalizes authentication errors without exposing the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid credential" } }), { status: 401 })));
    await expect(testProvider(config)).rejects.toMatchObject({ code: "AUTH", message: "Invalid credential" });
  });

  it("rejects insecure remote endpoints", async () => {
    await expect(testProvider({ ...config, baseUrl: "http://llm.example.test/v1" })).rejects.toMatchObject({ code: "PERMISSION" });
  });

  it("loads model ids from an OpenAI-compatible models endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "model-b" }, { id: "model-a" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listModels(config)).resolves.toEqual(["model-a", "model-b"]);
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/models", expect.objectContaining({ headers: { Authorization: "Bearer secret-test-key" } }));
  });

  it("distinguishes a missing Chrome host permission from a network failure", async () => {
    vi.stubGlobal("chrome", { permissions: { contains: vi.fn().mockResolvedValue(false) } });
    vi.stubGlobal("fetch", vi.fn());
    await expect(testProvider(config)).rejects.toMatchObject({ code: "PERMISSION", message: expect.stringContaining("has not granted") });
  });

  it("reports pre-HTTP network failures with the permission state", async () => {
    vi.stubGlobal("chrome", { permissions: { contains: vi.fn().mockResolvedValue(true) } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(testProvider(config)).rejects.toMatchObject({
      code: "PROVIDER",
      message: expect.stringContaining("host permission: granted"),
    });
  });

  it("accepts every allowlisted provider endpoint", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "OK" } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    for (const provider of Object.values(PROVIDER_DEFAULTS)) {
      await expect(testProvider({ ...provider, apiKey: "test-key", model: provider.model || "test-model" })).resolves.toMatchObject({ ok: true });
    }
    expect(fetchMock).toHaveBeenCalledTimes(Object.keys(PROVIDER_DEFAULTS).length);
  });
});

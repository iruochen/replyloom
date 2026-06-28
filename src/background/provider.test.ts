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

const runLiveMiniMax = process.env.RUN_LIVE_MINIMAX_TESTS === "1" && Boolean(process.env.MINIMAX_API_KEY);
const liveIt = runLiveMiniMax ? it : it.skip;

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

  it("uses a reasoning-safe budget and MiniMax-specific response settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ candidates: ["回复一", "回复二", "回复三"] }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await generateReplies({ ...config, preset: "minimax", baseUrl: "https://api.minimaxi.com/v1" }, post, DEFAULT_GENERATION_SETTINGS);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.max_tokens).toBe(768);
    expect(body.reasoning_split).toBe(true);
    expect(body.response_format).toBeUndefined();
  });

  it("retries with a compact plain-text request after a timeout", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("Timed out", "AbortError"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "1. 这个开头挺抓人，后面系列化会更容易涨粉。\n2. 这篇最有价值的是把 IP 设计这件事讲得很落地。\n3. 如果你后面写视频生成那一段，我会想继续看。" } }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateReplies(config, { ...post, text: "刚写了一篇关于怎么用 ChatGPT 做个人 IP 的长帖。", language: "zh" }, { ...DEFAULT_GENERATION_SETTINGS, language: "zh" });
    expect(result).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryRequest = fetchMock.mock.calls[1][1] as RequestInit;
    const retryBody = JSON.parse(String(retryRequest.body));
    expect(retryBody.response_format).toBeUndefined();
    expect(retryBody.max_tokens).toBe(220);
  });

  it("lightly naturalizes Chinese candidates without a second model call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ candidates: [
        { text: "值得一提的是，这个开头挺自然！" },
        { text: "节奏已经有了，再把内容方向钉住会更稳。" },
        { text: "蓝V只是起点，后面准备主打哪类内容？" },
      ] }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateReplies(config, { ...post, text: "刚拿到蓝V，准备开始认真做 X 了。", language: "zh" }, { ...DEFAULT_GENERATION_SETTINGS, language: "zh" });
    expect(result[0]?.text).toBe("这个开头挺自然！");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  liveIt("can generate three Chinese replies from the live MiniMax high-speed API", async () => {
    const liveConfig: ProviderConfig = {
      preset: "minimax",
      baseUrl: "https://api.minimaxi.com/v1",
      apiKey: process.env.MINIMAX_API_KEY!,
      model: process.env.MINIMAX_MODEL || "MiniMax-M2.7-highspeed",
      rememberKey: false,
    };

    const result = await generateReplies(liveConfig, {
      url: "https://x.com/example/status/live-minimax-check",
      text: "刚开始认真做 X，发现真正难的不是日更，而是每条内容都得有一点自己的判断。",
      language: "zh",
      extractedAt: Date.now(),
    }, {
      ...DEFAULT_GENERATION_SETTINGS,
      language: "zh",
      style: "insightful",
    });

    expect(result).toHaveLength(3);
    expect(result.every((candidate) => candidate.text.trim().length > 0)).toBe(true);
  }, 30_000);
});

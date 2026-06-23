import { describe, expect, it, vi } from "vitest";
import { parseCandidates } from "./candidates";

describe("parseCandidates", () => {
  it("parses a fenced JSON response and returns three candidates", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const result = parseCandidates(`\`\`\`json
      {"candidates":[
        {"text":"The trade-off here is speed versus trust.","angle":"trade-off"},
        {"text":"How are you measuring the quality lift?","angle":"question"},
        {"text":"The quiet win may be a much shorter feedback loop.","angle":"implication"}
      ]}
    \`\`\``);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: "123-0", text: "The trade-off here is speed versus trust.", angle: "trade-off" });
  });

  it("removes generic praise from the beginning", () => {
    const result = parseCandidates({ candidates: [
      { text: "Great post! The feedback loop is the real advantage." },
      { text: "Which metric changed first?" },
      { text: "This makes iteration cheaper, not just faster." },
    ] });
    expect(result[0].text).toBe("The feedback loop is the real advantage.");
  });

  it("rejects duplicate candidates", () => {
    expect(() => parseCandidates({ candidates: [
      { text: "Same reply." },
      { text: "Same reply!" },
      { text: "A different reply." },
    ] })).toThrow("fewer than three distinct replies");
  });

  it("parses MiniMax-style thinking followed by a raw JSON array", () => {
    const result = parseCandidates(`<think>Need three concise Chinese replies.</think>
      ["这个抽奖机制更像社区筛选。", "限量感可能比奖品本身更有传播力。", "图中手链的设计会公开吗？"]`);
    expect(result.map((item) => item.text)).toEqual([
      "这个抽奖机制更像社区筛选。",
      "限量感可能比奖品本身更有传播力。",
      "图中手链的设计会公开吗？",
    ]);
  });

  it("accepts alternate reply keys and numbered plain text", () => {
    expect(parseCandidates({ replies: [
      { reply: "第一条具体回复。" }, { content: "第二条具体回复。" }, { text: "第三条具体回复。" },
    ] })).toHaveLength(3);
    expect(parseCandidates("1. 第一条回复\n2. 第二条回复\n3. 第三条回复")).toHaveLength(3);
  });

  it("recovers object-shaped and nested MiniMax candidate payloads", () => {
    expect(parseCandidates({ candidates: { first: "第一条回复", second: "第二条回复", third: "第三条回复" } })).toHaveLength(3);
    expect(parseCandidates({ output: { reply_1: "第一条回复", reply_2: "第二条回复", reply_3: "第三条回复" } })).toHaveLength(3);
    expect(parseCandidates('候选回复：“第一条回复”“第二条回复”“第三条回复”')).toHaveLength(3);
  });
});

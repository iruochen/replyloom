import { describe, expect, it } from "vitest";
import { naturalizeCandidateText } from "./naturalize";

describe("naturalizeCandidateText", () => {
  it("removes common Chinese filler and cleans punctuation spacing", () => {
    expect(naturalizeCandidateText("值得一提的是， 这个节奏挺对 ！", "zh")).toBe("这个节奏挺对！");
  });

  it("keeps English text untouched apart from surrounding quotes and trim", () => {
    expect(naturalizeCandidateText(` "Sounds more direct." `, "en")).toBe("Sounds more direct.");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractPostContext, findTweetByUrl, findTweetFromTarget, insertDraftIntoComposer } from "./x-dom";

function renderTweet() {
  document.body.innerHTML = `
    <article data-testid="tweet">
      <div data-testid="User-Name">Alice\n@alice\n·</div>
      <div data-testid="tweetText" lang="en">AI products need shorter feedback loops.</div>
      <a href="/alice/status/123456">Jun 22</a>
      <div role="group"><button data-testid="reply">Reply</button></div>
    </article>
  `;
  return document.querySelector<HTMLElement>('article[data-testid="tweet"]')!;
}

describe("X DOM helpers", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/home");
    document.body.innerHTML = "";
  });

  it("finds the tweet containing an interaction target", () => {
    const article = renderTweet();
    const target = article.querySelector('[data-testid="reply"]');
    expect(findTweetFromTarget(target)).toBe(article);
  });

  it("extracts normalized post context", () => {
    const article = renderTweet();
    const result = extractPostContext(article);
    expect(result).toMatchObject({
      id: "123456",
      authorName: "Alice",
      authorHandle: "@alice",
      text: "AI products need shorter feedback loops.",
      language: "en",
    });
    expect(result?.url).toContain("/alice/status/123456");
  });

  it("locates a rendered tweet by status URL", () => {
    const article = renderTweet();
    expect(findTweetByUrl("https://x.com/alice/status/123456")).toBe(article);
  });

  it("inserts text into an existing reply editor without publishing", async () => {
    const article = renderTweet();
    window.history.replaceState({}, "", "/alice/status/123456");
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    document.body.append(editor);
    const replyButton = article.querySelector<HTMLButtonElement>('[data-testid="reply"]')!;
    const clickSpy = vi.spyOn(replyButton, "click");
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn((_command, _ui, text) => { editor.textContent = String(text); return true; }) });

    await expect(insertDraftIntoComposer(article, "A useful reply")).resolves.toBe(true);
    expect(editor.textContent).toBe("A useful reply");
    expect(clickSpy).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="tweetButton"]')).toBeNull();
  });

  it("inserts exactly once when the editor cancels the command (DraftJS-style)", async () => {
    const article = renderTweet();
    window.history.replaceState({}, "", "/alice/status/123456");
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    document.body.append(editor);
    // Mimic X's rich-text editor: it applies the edit to its own model (here, the
    // DOM text) and then reports `false` by cancelling the command. The insert
    // must still succeed and leave a single copy — no duplicating fallback.
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn((_command, _ui, text) => { editor.textContent = String(text); return false; }) });

    await expect(insertDraftIntoComposer(article, "One copy only")).resolves.toBe(true);
    expect(editor.textContent).toBe("One copy only");
  });

  it("uses an already-open dialog but never opens one itself", async () => {
    const article = renderTweet();
    const pageEditor = document.createElement("div");
    pageEditor.setAttribute("contenteditable", "true");
    pageEditor.setAttribute("role", "textbox");
    document.body.append(pageEditor);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const replyEditor = document.createElement("div");
    replyEditor.setAttribute("contenteditable", "true");
    replyEditor.setAttribute("role", "textbox");
    dialog.append(replyEditor);
    document.body.append(dialog);
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn((_command, _ui, text) => {
      const target = document.activeElement as HTMLElement;
      target.textContent = String(text);
      return true;
    }) });

    await expect(insertDraftIntoComposer(article, "Dialog reply")).resolves.toBe(true);
    expect(replyEditor.textContent).toBe("Dialog reply");
    expect(pageEditor.textContent).toBe("");
  });

  it("does not open a reply dialog when no editor is available", async () => {
    const article = renderTweet();
    const replyButton = article.querySelector<HTMLButtonElement>('[data-testid="reply"]')!;
    const clickSpy = vi.spyOn(replyButton, "click");
    await expect(insertDraftIntoComposer(article, "Draft")).resolves.toBe(false);
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

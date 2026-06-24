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

function renderArticleTweet() {
  document.body.innerHTML = `
    <article data-testid="tweet">
      <a href="/0xCheshire">柴郡</a>
      <a href="/0xCheshire">@0xCheshire</a>
      <a href="/0xCheshire/article/2069629825762181472">Article</a>
      <div>43</div>
      <div>2</div>
      <div>19</div>
      <div>5,660</div>
      <div>AI reply</div>
      <div>
        <div>从 0 开始，用 ChatGPT 打造专属个人 IP 形象（附超全提示词！）</div>
        <div>
          一直都想给自己搞个 IP 形象，想得不得了，从十几岁就开始想了，但一直没有动手，因为不会画画。
          但现在 AI 的绘画能力噌噌噌往上涨，最近 ChatGPT 的 image 2 绘画能力更是惊为天人。
          今天就让我来带大家一起用 ChatGPT 打造个人 IP 形象！
        </div>
      </div>
      <a href="/0xCheshire/status/2069629825762181472">Jun 24</a>
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

  it("extracts long-form article posts when tweetText is absent", () => {
    const article = renderArticleTweet();
    const result = extractPostContext(article);
    expect(result).toMatchObject({
      id: "2069629825762181472",
      authorName: "柴郡",
      authorHandle: "@0xCheshire",
      language: "zh",
    });
    expect(result?.text).toContain("从 0 开始，用 ChatGPT 打造专属个人 IP 形象");
    expect(result?.text).toContain("今天就让我来带大家一起用 ChatGPT 打造个人 IP 形象");
    expect(result?.text).not.toContain("5,660");
    expect(result?.text).not.toContain("AI reply");
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

  it("treats an already-filled editor as success without reinserting", async () => {
    const article = renderTweet();
    window.history.replaceState({}, "", "/alice/status/123456");
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.textContent = "Already here";
    document.body.append(editor);
    const execSpy = vi.fn();
    Object.defineProperty(document, "execCommand", { configurable: true, value: execSpy });

    await expect(insertDraftIntoComposer(article, "Already here")).resolves.toBe(true);
    expect(execSpy).not.toHaveBeenCalled();
    expect(editor.textContent).toBe("Already here");
  });

  it("dedupes concurrent insert requests for the same editor and draft", async () => {
    vi.useFakeTimers();
    const article = renderTweet();
    window.history.replaceState({}, "", "/alice/status/123456");
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    document.body.append(editor);
    const execSpy = vi.fn((_command, _ui, text) => {
      window.setTimeout(() => {
        editor.textContent = String(text);
      }, 10);
      return true;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: execSpy });

    const firstInsert = insertDraftIntoComposer(article, "One request, one copy");
    const secondInsert = insertDraftIntoComposer(article, "One request, one copy");
    await vi.runAllTimersAsync();

    await expect(firstInsert).resolves.toBe(true);
    await expect(secondInsert).resolves.toBe(true);
    expect(execSpy).toHaveBeenCalledTimes(1);
    expect(editor.textContent).toBe("One request, one copy");
    vi.useRealTimers();
  });

  it("avoids execCommand for the X composer when higher-level input works", async () => {
    const article = renderTweet();
    window.history.replaceState({}, "", "/alice/status/123456");
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("data-testid", "tweetTextarea_0");
    editor.addEventListener("beforeinput", (event) => {
      const draft = (event as InputEvent).data;
      if (draft) editor.textContent = draft;
    });
    document.body.append(editor);
    const execSpy = vi.fn((_command, _ui, text) => {
      editor.textContent = `${text}${text}`;
      return true;
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: execSpy });

    await expect(insertDraftIntoComposer(article, "Beforeinput wins")).resolves.toBe(true);
    expect(execSpy).not.toHaveBeenCalled();
    expect(editor.textContent).toBe("Beforeinput wins");
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

import type { PostContext } from "../shared/types";

const TWEET_SELECTOR = 'article[data-testid="tweet"]';

export function findTweetFromTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(TWEET_SELECTOR) : null;
}

export function findBestVisibleTweet(root: ParentNode = document): HTMLElement | null {
  const tweets = Array.from(root.querySelectorAll<HTMLElement>(TWEET_SELECTOR));
  const pathname = typeof location !== "undefined" ? location.pathname : "";
  const matchingUrl = tweets.find((tweet) => Array.from(tweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')).some((link) => link.pathname === pathname));
  if (matchingUrl) return matchingUrl;

  return tweets
    .filter((tweet) => Boolean(tweet.querySelector('[data-testid="tweetText"]')))
    .sort((a, b) => visibleArea(b) - visibleArea(a))[0] ?? null;
}

export function extractPostContext(article: HTMLElement): PostContext | null {
  const textNode = article.querySelector<HTMLElement>('[data-testid="tweetText"]');
  const text = getElementText(textNode);
  if (!text) return null;

  const statusLinks = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'));
  const canonical = statusLinks.find((link) => /\/[^/]+\/status\/\d+/.test(link.pathname)) ?? statusLinks[0];
  const url = canonical ? new URL(canonical.getAttribute("href") ?? "", location.origin).href : location.href;
  const id = url.match(/\/status\/(\d+)/)?.[1];
  const userName = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
  const parts = getElementText(userName).split("\n").map((part) => part.trim()).filter(Boolean);
  const handle = parts.find((part) => part.startsWith("@"));
  const authorName = parts.find((part) => !part.startsWith("@") && !/^·$/.test(part));
  const lang = textNode?.getAttribute("lang") ?? detectLanguage(text);

  const tweetTexts = Array.from(article.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'));
  const quoteText = tweetTexts.length > 1 ? getElementText(tweetTexts[tweetTexts.length - 1]) : "";

  return {
    id,
    url,
    authorName,
    authorHandle: handle,
    text,
    language: lang,
    quotedPost: quoteText && quoteText !== text ? { text: quoteText, url } : undefined,
    extractedAt: Date.now(),
  };
}

export function findTweetByUrl(postUrl: string, root: ParentNode = document): HTMLElement | null {
  const expectedId = postUrl.match(/\/status\/(\d+)/)?.[1];
  if (!expectedId) return null;
  return Array.from(root.querySelectorAll<HTMLElement>(TWEET_SELECTOR)).find((tweet) =>
    Boolean(tweet.querySelector(`a[href*="/status/${expectedId}"]`)),
  ) ?? null;
}

export async function insertDraftIntoComposer(article: HTMLElement | null, text: string): Promise<boolean> {
  const editor = findBestReplyEditor(article);
  if (!editor) return false;

  // Replace whatever is in the editor with the draft, deciding success by
  // inspecting the editor's text afterwards rather than trusting a command's
  // return value. X's DraftJS editor applies the edit to its own model and then
  // cancels execCommand's input event, so execCommand reports `false` even
  // though the text landed. The old code treated that `false` as failure and
  // ran a fallback that injected a second, untracked text node: the draft then
  // appeared twice, and the trailing copy (absent from DraftJS's model) could
  // not be deleted, even though posting used the single modelled copy. We never
  // hand-insert DOM nodes now — if no strategy lands, we simply report failure.
  if (insertViaCommand(editor, text)) return collapseToEnd(editor);
  if (insertViaPaste(editor, text)) return collapseToEnd(editor);
  if (insertViaBeforeInput(editor, text)) return collapseToEnd(editor);
  return false;
}

// True once the editor's text matches the draft. Whitespace is collapsed away
// because DraftJS renders each line as its own block, so multi-line drafts come
// back without the original newlines between blocks.
function editorHasText(editor: HTMLElement, text: string): boolean {
  const compact = (value: string) => value.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, "");
  const target = compact(text);
  return target.length > 0 && compact(editor.textContent ?? "") === target;
}

function selectAllContent(editor: HTMLElement) {
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function insertViaCommand(editor: HTMLElement, text: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  selectAllContent(editor);
  document.execCommand("insertText", false, text);
  return editorHasText(editor, text);
}

function insertViaPaste(editor: HTMLElement, text: string): boolean {
  try {
    if (typeof DataTransfer !== "function" || typeof ClipboardEvent !== "function") return false;
    selectAllContent(editor);
    const data = new DataTransfer();
    data.setData("text/plain", text);
    editor.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
    return editorHasText(editor, text);
  } catch {
    return false;
  }
}

function insertViaBeforeInput(editor: HTMLElement, text: string): boolean {
  selectAllContent(editor);
  editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, inputType: "insertText", data: text }));
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: text }));
  return editorHasText(editor, text);
}

// Collapse the caret to the end so the user can keep typing.
function collapseToEnd(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  const end = document.createRange();
  end.selectNodeContents(editor);
  end.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(end);
  editor.focus();
  return true;
}

function findReplyEditors() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="tweetTextarea_0"][contenteditable="true"], [role="textbox"][contenteditable="true"]'));
}

function findBestReplyEditor(article: HTMLElement | null) {
  const editors = findReplyEditors().filter(isUsableEditor);
  const active = editors.find((editor) => editor === document.activeElement || editor.contains(document.activeElement));
  if (active) return active;
  const dialog = editors.find((editor) => Boolean(editor.closest('[role="dialog"]')));
  if (dialog) return dialog;
  if (!/\/status\/\d+/.test(location.pathname)) return null;
  if (!article) return editors[0] ?? null;
  const articleRect = article.getBoundingClientRect();
  return editors.sort((a, b) => editorDistance(a, articleRect) - editorDistance(b, articleRect))[0] ?? null;
}

function editorDistance(editor: HTMLElement, articleRect: DOMRect) {
  const rect = editor.getBoundingClientRect();
  return Math.abs(rect.top - articleRect.bottom) + Math.abs(rect.left - articleRect.left) * 0.25;
}

function isUsableEditor(editor: HTMLElement) {
  if (editor.hidden || editor.closest('[aria-hidden="true"]')) return false;
  const style = getComputedStyle(editor);
  return style.display !== "none" && style.visibility !== "hidden";
}

function visibleArea(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
  return width * height;
}

function detectLanguage(text: string) {
  return /[\u3400-\u9fff]/.test(text) ? "zh" : "en";
}

function getElementText(element: HTMLElement | null) {
  return (element?.innerText ?? element?.textContent ?? "").trim();
}

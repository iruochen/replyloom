import type { RuntimeRequest, RuntimeResponse } from "../shared/types";
import { extractPostContext, findBestVisibleTweet, findTweetByUrl, findTweetFromTarget, insertDraftIntoComposer } from "./x-dom";

declare global {
  interface Window { __replyLoomLoaded?: string }
}

const BUTTON_CLASS = "reply-loom-trigger";
const INSTANCE_ID = crypto.randomUUID();
const LAUNCHER_POSITION_KEY = "floatingLauncherPosition";
const PANEL_POSITION_KEY = "floatingPanelPosition";
let lastSelectedTweet: HTMLElement | null = null;
let lastAutoReadKey = "";
let panelMode: "side" | "floating" = "floating";
let floatingHost: HTMLElement | null = null;
let floatingFrame: HTMLIFrameElement | null = null;

function installTriggers(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('article[data-testid="tweet"]').forEach((article) => {
    const existing = article.querySelector<HTMLElement>(`.${BUTTON_CLASS}`);
    if (existing?.dataset.replyXInstance === INSTANCE_ID) return;
    existing?.remove();
    const actions = article.querySelector<HTMLElement>('[role="group"]');
    if (!actions) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.dataset.replyXInstance = INSTANCE_ID;
    button.textContent = "AI reply";
    button.setAttribute("aria-label", "Generate an AI-assisted reply draft");
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      lastSelectedTweet = article;
      const post = extractPostContext(article);
      if (!post) return;
      await chrome.runtime.sendMessage({ type: "POST_SELECTED", post, panelMode } satisfies RuntimeRequest);
      if (panelMode === "floating") openFloatingPanel(true);
    });
    actions.append(button);
  });
}

function installContentStyle() {
  document.getElementById("reply-loom-content-style")?.remove();
  const style = document.createElement("style");
  style.id = "reply-loom-content-style";
  style.textContent = `
    .${BUTTON_CLASS} {
      appearance: none; border: 0; background: transparent; color: rgb(99, 102, 241);
      cursor: pointer; min-height: 32px; padding: 0 10px; border-radius: 999px;
      font: 600 12px/1 system-ui, sans-serif;
    }
    .${BUTTON_CLASS}:hover { background: rgba(99, 102, 241, .12); }
    .${BUTTON_CLASS}:focus-visible { outline: 2px solid rgb(99, 102, 241); outline-offset: 2px; }
  `;
  document.documentElement.append(style);
}

// When the page navigates to a single tweet (a /status/<id> URL), read the
// focused tweet automatically and stash it as the selected post — without
// forcing the side panel open. The panel/iframe picks it up live via storage.
function maybeAutoReadPost() {
  if (!/\/status\/\d+/.test(location.pathname)) { lastAutoReadKey = ""; return; }
  if (location.pathname === lastAutoReadKey) return;
  const article = findBestVisibleTweet();
  if (!article) return;
  const post = extractPostContext(article);
  if (!post) return;
  lastAutoReadKey = location.pathname;
  lastSelectedTweet = article;
  void chrome.runtime.sendMessage({ type: "POST_SELECTED", post, panelMode, auto: true } satisfies RuntimeRequest);
}

function installFloatingPanel() {
  if (floatingHost || panelMode !== "floating") return;
  document.getElementById("reply-loom-floating-host")?.remove();
  const host = document.createElement("div");
  host.id = "reply-loom-floating-host";
  const shadow = host.attachShadow({ mode: "open" });
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "launcher";
  launcher.textContent = "RL";
  launcher.setAttribute("aria-label", "Open ReplyLoom");
  launcher.title = "ReplyLoom — drag to move, click to open";
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.hidden = true;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close ReplyLoom");
  const panelBar = document.createElement("div");
  panelBar.className = "panelBar";
  panelBar.tabIndex = 0;
  panelBar.setAttribute("role", "toolbar");
  panelBar.setAttribute("aria-label", "Drag to move ReplyLoom panel; use arrow keys for precise movement");
  const panelTitle = document.createElement("span");
  panelTitle.textContent = "ReplyLoom";
  panelBar.append(panelTitle, close);
  const frameWrap = document.createElement("div");
  frameWrap.className = "frameWrap";
  const frame = document.createElement("iframe");
  frame.title = "ReplyLoom";
  frame.src = chrome.runtime.getURL("sidepanel.html?mode=floating");
  frameWrap.append(frame);
  panel.append(panelBar, frameWrap);
  shadow.append(document.createElement("style"), panel, launcher);
  const panelStyle = shadow.querySelector("style")!;
  panelStyle.textContent = `
    :host { all: initial; }
    .launcher { position: fixed; z-index: 2147483646; right: 22px; bottom: 140px; width: 52px; height: 52px; border: 0; border-radius: 17px; background: #6366f1; color: white; box-shadow: 0 14px 36px rgba(15,23,42,.28); cursor: grab; touch-action: none; user-select: none; font: 800 14px/1 system-ui,sans-serif; letter-spacing: -.02em; }
    .launcher:hover { background: #4f46e5; transform: translateY(-1px); }
    .launcher.dragging { cursor: grabbing; transform: scale(.97); }
    .launcher:focus-visible, .close:focus-visible { outline: 3px solid rgba(99,102,241,.4); outline-offset: 3px; }
    .panel { position: fixed; z-index: 2147483647; right: 22px; bottom: 22px; display: grid; grid-template-rows: 48px minmax(0, 1fr); width: min(390px, calc(100vw - 28px)); height: min(720px, calc(100vh - 44px)); overflow: hidden; border: 1px solid rgba(148,163,184,.35); border-radius: 18px; background: #fff; box-shadow: 0 24px 70px rgba(15,23,42,.32); }
    .panel[hidden] { display: none; }
    .panelBar { display: flex; align-items: center; justify-content: space-between; min-width: 0; padding: 0 8px 0 16px; border-bottom: 1px solid #e5e7eb; background: rgba(248,250,252,.96); color: #4f46e5; cursor: grab; touch-action: none; user-select: none; font: 800 12px/1 system-ui,sans-serif; letter-spacing: .08em; text-transform: uppercase; }
    .panelBar.dragging { cursor: grabbing; }
    .frameWrap { min-height: 0; overflow: hidden; }
    iframe { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
    .close { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; color: #374151; cursor: pointer; font: 500 24px/1 system-ui,sans-serif; }
    @media (max-width: 520px) { .panel { inset: 10px; width: auto; height: auto; } .launcher { right: 14px; bottom: 14px; } }
    @media (prefers-color-scheme: dark) { .panel, iframe { background: #0b0d12; } .panelBar { background: #10141b; border-color: #2a3140; } .close { background: #151922; border-color: #2a3140; color: #e5e7eb; } }
  `;
  let dragStart: { pointerX: number; pointerY: number; left: number; top: number } | null = null;
  let panelDragStart: { pointerX: number; pointerY: number; left: number; top: number } | null = null;
  let dragged = false;
  let panelDragged = false;
  const placeLauncher = (left: number, top: number) => {
    const safe = 12;
    launcher.style.left = `${Math.max(safe, Math.min(left, window.innerWidth - 52 - safe))}px`;
    launcher.style.top = `${Math.max(safe, Math.min(top, window.innerHeight - 52 - safe))}px`;
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
  };
  const saveLauncherPosition = () => {
    const rect = launcher.getBoundingClientRect();
    void chrome.storage.local.set({ [LAUNCHER_POSITION_KEY]: { left: rect.left, top: rect.top } });
  };
  const placePanel = (left: number, top: number) => {
    const safe = 12;
    const rect = panel.getBoundingClientRect();
    const width = rect.width || Math.min(390, window.innerWidth - 28);
    const height = rect.height || Math.min(720, window.innerHeight - 44);
    panel.style.left = `${Math.max(safe, Math.min(left, window.innerWidth - width - safe))}px`;
    panel.style.top = `${Math.max(safe, Math.min(top, window.innerHeight - height - safe))}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };
  const savePanelPosition = () => {
    const rect = panel.getBoundingClientRect();
    void chrome.storage.local.set({ [PANEL_POSITION_KEY]: { left: rect.left, top: rect.top } });
  };
  launcher.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = launcher.getBoundingClientRect();
    dragStart = { pointerX: event.clientX, pointerY: event.clientY, left: rect.left, top: rect.top };
    dragged = false;
    launcher.setPointerCapture(event.pointerId);
  });
  launcher.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.pointerX;
    const dy = event.clientY - dragStart.pointerY;
    if (!dragged && Math.hypot(dx, dy) < 6) return;
    dragged = true;
    launcher.classList.add("dragging");
    placeLauncher(dragStart.left + dx, dragStart.top + dy);
  });
  launcher.addEventListener("pointerup", (event) => {
    if (!dragStart) return;
    launcher.releasePointerCapture(event.pointerId);
    dragStart = null;
    launcher.classList.remove("dragging");
    if (dragged) saveLauncherPosition();
  });
  launcher.addEventListener("click", () => {
    if (dragged) { dragged = false; return; }
    panel.hidden = !panel.hidden;
  });
  launcher.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const rect = launcher.getBoundingClientRect();
    placeLauncher(rect.left + (event.key === "ArrowLeft" ? -12 : event.key === "ArrowRight" ? 12 : 0), rect.top + (event.key === "ArrowUp" ? -12 : event.key === "ArrowDown" ? 12 : 0));
    saveLauncherPosition();
  });
  panelBar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target === close || window.innerWidth <= 520) return;
    const rect = panel.getBoundingClientRect();
    panelDragStart = { pointerX: event.clientX, pointerY: event.clientY, left: rect.left, top: rect.top };
    panelDragged = false;
    panelBar.setPointerCapture(event.pointerId);
  });
  panelBar.addEventListener("pointermove", (event) => {
    if (!panelDragStart) return;
    const dx = event.clientX - panelDragStart.pointerX;
    const dy = event.clientY - panelDragStart.pointerY;
    if (!panelDragged && Math.hypot(dx, dy) < 6) return;
    panelDragged = true;
    panelBar.classList.add("dragging");
    placePanel(panelDragStart.left + dx, panelDragStart.top + dy);
  });
  panelBar.addEventListener("pointerup", (event) => {
    if (!panelDragStart) return;
    panelBar.releasePointerCapture(event.pointerId);
    panelDragStart = null;
    panelBar.classList.remove("dragging");
    if (panelDragged) savePanelPosition();
  });
  panelBar.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || window.innerWidth <= 520) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    placePanel(rect.left + (event.key === "ArrowLeft" ? -12 : event.key === "ArrowRight" ? 12 : 0), rect.top + (event.key === "ArrowUp" ? -12 : event.key === "ArrowDown" ? 12 : 0));
    savePanelPosition();
  });
  close.addEventListener("click", () => { panel.hidden = true; });
  document.documentElement.append(host);
  floatingHost = host;
  floatingFrame = frame;
  void chrome.storage.local.get([LAUNCHER_POSITION_KEY, PANEL_POSITION_KEY]).then((result) => {
    const saved = result[LAUNCHER_POSITION_KEY] as { left?: number; top?: number } | undefined;
    if (typeof saved?.left === "number" && typeof saved.top === "number") placeLauncher(saved.left, saved.top);
    const savedPanel = result[PANEL_POSITION_KEY] as { left?: number; top?: number } | undefined;
    if (typeof savedPanel?.left === "number" && typeof savedPanel.top === "number" && window.innerWidth > 520) placePanel(savedPanel.left, savedPanel.top);
  });
  window.addEventListener("resize", () => {
    const rect = launcher.getBoundingClientRect();
    if (launcher.style.left) placeLauncher(rect.left, rect.top);
    const panelRect = panel.getBoundingClientRect();
    if (panel.style.left && window.innerWidth > 520) placePanel(panelRect.left, panelRect.top);
  });
}

function removeFloatingPanel() {
  floatingHost?.remove();
  floatingHost = null;
  floatingFrame = null;
}

function openFloatingPanel(refresh = false) {
  installFloatingPanel();
  if (!floatingHost || !floatingFrame) return;
  if (refresh) floatingFrame.src = chrome.runtime.getURL(`sidepanel.html?mode=floating&selected=${Date.now()}`);
  const panel = floatingHost.shadowRoot?.querySelector<HTMLElement>(".panel");
  if (panel) panel.hidden = false;
}

function init() {
  installContentStyle();

  document.addEventListener("click", (event) => {
    const tweet = findTweetFromTarget(event.target);
    if (tweet) lastSelectedTweet = tweet;
  }, true);

  let scanTimer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => { installTriggers(); maybeAutoReadPost(); }, 120);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  installTriggers();

  void chrome.storage.local.get("appPreferences").then((result) => {
    const preferences = result.appPreferences as { panelMode?: string } | undefined;
    panelMode = preferences?.panelMode === "side" ? "side" : "floating";
    if (panelMode === "floating") installFloatingPanel();
    maybeAutoReadPost();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.appPreferences) return;
    const preferences = changes.appPreferences.newValue as { panelMode?: string } | undefined;
    panelMode = preferences?.panelMode === "side" ? "side" : "floating";
    if (panelMode === "floating") installFloatingPanel(); else removeFloatingPanel();
  });

  registerMessageHandler();
}

function registerMessageHandler() {
chrome.runtime.onMessage.addListener((request: RuntimeRequest, _sender, sendResponse: (response: RuntimeResponse) => void) => {
  if (request.type === "PING") {
    sendResponse({ ok: true, data: true });
    return;
  }

  if (request.type === "EXTRACT_ACTIVE_POST") {
    const article = lastSelectedTweet?.isConnected ? lastSelectedTweet : findBestVisibleTweet();
    const post = article ? extractPostContext(article) : null;
    sendResponse(post ? { ok: true, data: post } : { ok: false, error: { code: "NO_POST", message: "Select a post on X, then try again." } });
    return;
  }

  if (request.type === "INSERT_DRAFT") {
    const article = findTweetByUrl(request.postUrl) ?? lastSelectedTweet;
    void insertDraftIntoComposer(article, request.text).then((inserted) => {
      sendResponse(inserted
        ? { ok: true, data: true }
        : { ok: false, error: { code: "INSERTION", message: "Open the inline reply editor on X first, then try Insert again. ReplyLoom will not open the Reply dialog automatically." } });
    });
    return true;
  }
});
}

// Guard against double initialization: the background may re-inject content.js
// (via chrome.scripting) on top of the manifest-injected instance. Without this
// guard every injection stacks another onMessage listener, which made a single
// INSERT_DRAFT run the insertion twice.
if (!window.__replyLoomLoaded) {
  window.__replyLoomLoaded = INSTANCE_ID;
  init();
}

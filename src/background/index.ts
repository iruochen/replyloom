import { ProviderError, generateReplies, listModels, testProvider } from "./provider";
import { getAppPreferences, getProviderConfig, getProviderProfiles, getSelectedPost, saveAppPreferences, saveProviderConfig, saveSelectedPost } from "./storage";
import type { AppError, PostContext, RuntimeRequest, RuntimeResponse } from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("https://x.com/")) return;
  try {
    const response = await sendToContent<PostContext>(tab.id, { type: "EXTRACT_ACTIVE_POST" });
    if (response.ok) await saveSelectedPost(response.data);
  } catch {
    // The panel still opens and offers a manual recovery state.
  }
});

chrome.runtime.onMessage.addListener((request: RuntimeRequest, sender, sendResponse: (response: RuntimeResponse) => void) => {
  void handleMessage(request, sender).then(sendResponse).catch((error) => sendResponse(toErrorResponse(error)));
  return true;
});

async function handleMessage(request: RuntimeRequest, sender: chrome.runtime.MessageSender): Promise<RuntimeResponse> {
  switch (request.type) {
    case "PING":
      return { ok: true, data: true };

    case "GET_STATE":
      return { ok: true, data: { post: await getSelectedPost() } };

    case "POST_SELECTED":
      await Promise.all([
        saveSelectedPost(request.post),
        sender.tab?.id && request.panelMode !== "floating" ? chrome.sidePanel.open({ tabId: sender.tab.id }) : Promise.resolve(),
      ]);
      return { ok: true, data: request.post };

    case "EXTRACT_ACTIVE_POST": {
      const tab = await getActiveXTab();
      if (!tab.id) return noPost();
      const response = await sendToContent<PostContext>(tab.id, request);
      if (response.ok) await saveSelectedPost(response.data);
      return response;
    }

    case "GET_PROVIDER_CONFIG":
      return { ok: true, data: await getProviderConfig() };

    case "GET_PROVIDER_PROFILES":
      return { ok: true, data: await getProviderProfiles() };

    case "SAVE_PROVIDER_CONFIG":
      await saveProviderConfig(request.config);
      return { ok: true, data: true };

    case "GET_APP_PREFERENCES":
      return { ok: true, data: await getAppPreferences() };

    case "SAVE_APP_PREFERENCES":
      await saveAppPreferences(request.preferences);
      if (request.preferences.panelMode === "floating") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url?.startsWith("https://x.com/")) await ensureContentScript(tab.id);
      }
      return { ok: true, data: true };

    case "TEST_PROVIDER":
      return { ok: true, data: await testProvider(request.config) };

    case "LIST_PROVIDER_MODELS":
      return { ok: true, data: await listModels(request.config) };

    case "GENERATE_REPLIES":
      return { ok: true, data: await generateReplies(await getProviderConfig(), request.post, request.settings) };

    case "INSERT_DRAFT": {
      const tab = await getActiveXTab();
      if (!tab.id) return noPost();
      return await sendToContent(tab.id, request);
    }
  }
}

async function ensureContentScript(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" } satisfies RuntimeRequest);
  } catch (error) {
    if (!isMissingReceiver(error)) throw error;
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

async function sendToContent<T = unknown>(tabId: number, request: RuntimeRequest): Promise<RuntimeResponse<T>> {
  try {
    return await chrome.tabs.sendMessage(tabId, request) as RuntimeResponse<T>;
  } catch (error) {
    if (!isMissingReceiver(error)) throw error;
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return await chrome.tabs.sendMessage(tabId, request) as RuntimeResponse<T>;
  }
}

function isMissingReceiver(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Receiving end does not exist|Could not establish connection/i.test(message);
}

async function getActiveXTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.url?.startsWith("https://x.com/")) throw new Error("Open X in the active tab, then try again.");
  return tab;
}

function noPost(): RuntimeResponse<never> {
  return { ok: false, error: { code: "NO_POST", message: "Select a post on X, then try again." } };
}

function toErrorResponse(error: unknown): RuntimeResponse<never> {
  if (error instanceof ProviderError) return { ok: false, error: { code: error.code, message: error.message } };
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const appError: AppError = { code: "UNKNOWN", message };
  return { ok: false, error: appError };
}

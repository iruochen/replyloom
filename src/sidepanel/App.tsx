import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_APP_PREFERENCES, DEFAULT_GENERATION_SETTINGS, DEFAULT_PROVIDER_CONFIG, PROVIDER_DEFAULTS, type AppPreferences, type GenerationSettings, type PanelMode, type PostContext, type ProviderConfig, type ProviderPreset, type ProviderProfiles, type ReplyCandidate, type ReplyStyle } from "../shared/types";
import { extractActivePost, generateReplies, getAppPreferences, getProviderConfig, getProviderProfiles, getState, insertDraft, listProviderModels, requestProviderPermission, saveAppPreferences, saveProviderConfig, testProvider } from "./api";

const providerHints: Record<ProviderPreset, { placeholder: string; zh: string; en: string }> = {
  openai: { placeholder: "https://api.openai.com/v1", zh: "OpenAI 官方地址，需要保留末尾的 /v1。", en: "Official OpenAI endpoint; keep the trailing /v1." },
  deepseek: { placeholder: "https://api.deepseek.com", zh: "DeepSeek 官方地址，可不写 /v1。", en: "Official DeepSeek endpoint; /v1 is not required." },
  minimax: { placeholder: "https://api.minimaxi.com/v1", zh: "MiniMax 官方 OpenAI-compatible 地址，需要保留 /v1。", en: "Official MiniMax OpenAI-compatible endpoint; keep /v1." },
  glm: { placeholder: "https://open.bigmodel.cn/api/paas/v4", zh: "智谱 GLM 的 OpenAI-compatible 地址。", en: "Zhipu GLM OpenAI-compatible endpoint." },
  doubao: { placeholder: "https://ark.cn-beijing.volces.com/api/v3", zh: "火山方舟（豆包）北京区域地址；模型处可填写模型 ID 或接入点 ID。", en: "Volcengine Ark (Doubao), Beijing region. Enter a model or endpoint ID below." },
  qwen: { placeholder: "https://dashscope.aliyuncs.com/compatible-mode/v1", zh: "阿里云百炼中国内地 OpenAI-compatible 地址。", en: "Alibaba Cloud Model Studio OpenAI-compatible endpoint for mainland China." },
  moonshot: { placeholder: "https://api.moonshot.cn/v1", zh: "Moonshot AI（Kimi）官方 OpenAI-compatible 地址。", en: "Official Moonshot AI (Kimi) OpenAI-compatible endpoint." },
  siliconflow: { placeholder: "https://api.siliconflow.cn/v1", zh: "硅基流动官方 OpenAI-compatible 地址。", en: "Official SiliconFlow OpenAI-compatible endpoint." },
};

const providerLabels: Record<ProviderPreset, { zh: string; en: string }> = {
  openai: {zh: "OpenAI", en: "OpenAI"},
  deepseek: {zh: "DeepSeek", en: "DeepSeek"},
  minimax: {zh: "MiniMax", en: "MiniMax"},
  glm: {zh: "智谱 GLM", en: "Zhipu GLM"},
  doubao: {zh: "豆包 / 火山方舟", en: "Doubao / Volcengine Ark"},
  qwen: {zh: "通义千问 / 阿里云百炼", en: "Qwen / Alibaba Cloud Model Studio"},
  moonshot: {zh: "Moonshot / Kimi", en: "Moonshot AI / Kimi"},
  siliconflow: {zh: "硅基流动", en: "SiliconFlow"},
};

const providerPresets = Object.keys(providerLabels) as ProviderPreset[];

const copy = {
  zh: {
    settings: "设置", connect: "连接你的模型", back: "返回评论生成", provider: "服务商",
    baseUrl: "Base URL", actualEndpoint: "实际生成地址", model: "模型名称", modelPlaceholder: "输入或获取模型", loading: "读取中…", loadModels: "获取列表",
    modelHelp: "填写 API Key 后可读取服务商的 /models 接口；若不支持，仍可手动输入。", apiKey: "API Key", hide: "隐藏", show: "显示",
    remember: "在这台设备上保存 API Key", privacy: "密钥只保存在扩展存储中，不会交给 X 页面；浏览器本地存储不等同于服务端密钥保险箱。",
    testing: "测试中…", test: "测试连接", saving: "保存中…", save: "保存", saved: "模型配置已保存。", permission: "需要允许访问该模型接口，扩展才能发送请求。",
    modelPermission: "需要允许访问该模型接口，才能读取可用模型。", modelsLoaded: (count: number) => `已读取 ${count} 个可用模型，可从列表选择或继续手动输入。`,
    display: "界面", language: "界面语言", panelMode: "面板模式", side: "固定侧边栏", floating: "悬浮面板", floatingHint: "默认已开启：访问 X 时右下角会出现 ReplyLoom 悬浮按钮。想关闭就切换到「固定侧边栏」。", floatingEnabled: "悬浮模式已启用。关闭右侧栏后，点击 X 页面右下角的 RL 按钮。", sideEnabled: "固定侧边栏模式已启用。",
    tagline: "把一条好推文，变成一段好对话。", openSettings: "打开设置", currentPost: "当前推文", xUser: "X 用户", reread: "重新读取",
    empty: "在 X 上点击推文下方的 AI reply，或读取当前页面中的推文。", reading: "读取中…", readPost: "读取当前推文", manual: "读取失败？手动粘贴", paste: "粘贴推文正文…",
    replyStyle: "评论风格", styles: ["精简", "有洞察", "幽默", "支持", "提问"], length: "长度", short: "短", medium: "中等", replyLanguage: "回复语言", follow: "跟随原文", chinese: "中文", english: "英文",
    advanced: "个性化设置", voice: "我的表达风格", voicePlaceholder: "例如：像开发者本人，克制、好奇，不用 emoji", extra: "本次额外要求", extraPlaceholder: "例如：不要提价格，聚焦产品体验",
    generating: "正在生成…", generationPhases: ["正在理解推文语境", "正在构思三个不同角度", "正在整理成可编辑回复"], elapsed: (seconds: number) => `已等待 ${seconds} 秒`, regenerate: "重新生成 3 条", generate: "生成 3 条评论", candidate: "候选评论", chars: "字符", copy: "复制", inserting: "填入中…", insert: "填入回复框",
    footnote: "AI 负责起草，你负责判断和发布。", needConfig: "请先配置模型接口和 API Key。", inserted: "已填入 X 回复框，请检查后手动发布。", copied: "已复制到剪贴板。", copyFailed: "复制失败，请选中文本手动复制。", unknown: "发生了未知错误。",
  },
  en: {
    settings: "Settings", connect: "Connect your model", back: "Back to reply composer", provider: "Provider",
    baseUrl: "Base URL", actualEndpoint: "Generation endpoint", model: "Model", modelPlaceholder: "Enter or load a model", loading: "Loading…", loadModels: "Load models",
    modelHelp: "After adding an API key, load models from the provider's /models endpoint, or enter one manually.", apiKey: "API Key", hide: "Hide", show: "Show",
    remember: "Save API Key on this device", privacy: "The key stays in extension storage and is never exposed to the X page. Browser storage is not a server-side secret vault.",
    testing: "Testing…", test: "Test connection", saving: "Saving…", save: "Save", saved: "Model configuration saved.", permission: "Allow access to this model endpoint before ReplyLoom can send requests.",
    modelPermission: "Allow access to this endpoint before loading models.", modelsLoaded: (count: number) => `Loaded ${count} models. Choose one or keep typing manually.`,
    display: "Appearance", language: "Interface language", panelMode: "Panel mode", side: "Docked side panel", floating: "Floating panel", floatingHint: "On by default: a ReplyLoom launcher appears at the lower-right of X. Switch to the docked side panel to turn it off.", floatingEnabled: "Floating mode is on. Close the side panel, then click RL in the lower-right corner of X.", sideEnabled: "Docked side panel mode is on.",
    tagline: "Turn a good post into a better conversation.", openSettings: "Open settings", currentPost: "Current post", xUser: "X user", reread: "Read again",
    empty: "Click AI reply under a post on X, or read the current post.", reading: "Reading…", readPost: "Read current post", manual: "Can't read it? Paste manually", paste: "Paste the post text…",
    replyStyle: "Reply style", styles: ["Concise", "Insightful", "Humorous", "Supportive", "Question"], length: "Length", short: "Short", medium: "Medium", replyLanguage: "Reply language", follow: "Match source", chinese: "Chinese", english: "English",
    advanced: "Personalize", voice: "My voice", voicePlaceholder: "Example: restrained and curious, no emoji", extra: "Extra instruction", extraPlaceholder: "Example: focus on product experience, not pricing",
    generating: "Generating…", generationPhases: ["Reading the post context", "Exploring three reply angles", "Polishing editable drafts"], elapsed: (seconds: number) => `${seconds}s elapsed`, regenerate: "Generate 3 more", generate: "Generate 3 replies", candidate: "Draft replies", chars: "chars", copy: "Copy", inserting: "Inserting…", insert: "Insert into X",
    footnote: "AI drafts. You decide and publish.", needConfig: "Configure a model endpoint and API key first.", inserted: "Inserted into the X reply editor. Review it before posting.", copied: "Copied to clipboard.", copyFailed: "Copy failed. Select and copy the text manually.", unknown: "Something went wrong.",
  },
} as const;

const styleValues: ReplyStyle[] = ["concise", "insightful", "humorous", "supportive", "question"];

export function App() {
  const [view, setView] = useState<"compose" | "settings">("compose");
  const [post, setPost] = useState<PostContext | null>(null);
  const [manualText, setManualText] = useState("");
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_GENERATION_SETTINGS);
  const [provider, setProvider] = useState<ProviderConfig>(DEFAULT_PROVIDER_CONFIG);
  const [profiles, setProfiles] = useState<ProviderProfiles>(PROVIDER_DEFAULTS);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [candidates, setCandidates] = useState<ReplyCandidate[]>([]);
  const [busy, setBusy] = useState<"loading" | "extracting" | "generating" | "saving" | "testing" | "models" | "inserting" | null>("loading");
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [scrollHints, setScrollHints] = useState({ active: false, top: false, bottom: false });
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const scrollTimer = useRef<number | null>(null);
  const t = copy[preferences.uiLanguage];

  useEffect(() => {
    void Promise.all([getState(), getProviderConfig(), getProviderProfiles(), getAppPreferences()])
      .then(([state, config, savedProfiles, savedPreferences]) => {
        setPost(state.post); setProvider(config); setProfiles(savedProfiles); setPreferences(savedPreferences);
      })
      .catch((error: Error) => setNotice({ tone: "error", text: error.message }))
      .finally(() => setBusy(null));
  }, []);

  useEffect(() => {
    document.documentElement.lang = preferences.uiLanguage === "zh" ? "zh-CN" : "en";
  }, [preferences.uiLanguage]);

  useEffect(() => {
    if (busy !== "generating") return;
    setGenerationSeconds(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (notice?.tone !== "success") return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Reflect posts read automatically by the content script (e.g. when the user
  // opens a tweet) live, without needing a manual re-read.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== "session" || !changes.selectedPost) return;
      const next = changes.selectedPost.newValue as PostContext | undefined;
      if (!next) return;
      setPost(next);
      setManualText("");
      setCandidates([]);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const update = (active: boolean) => setScrollHints({
      active,
      top: window.scrollY > 8,
      bottom: window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 8,
    });
    const onScroll = () => {
      update(true);
      if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
      scrollTimer.current = window.setTimeout(() => update(false), 180);
    };
    update(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (scrollTimer.current !== null) window.clearTimeout(scrollTimer.current);
    };
  }, []);

  const source = useMemo<PostContext | null>(() => post ?? (manualText.trim() ? { url: "manual://source", text: manualText.trim(), extractedAt: Date.now() } : null), [manualText, post]);

  async function updatePreferences(update: Partial<AppPreferences>) {
    const next = { ...preferences, ...update };
    setPreferences(next);
    try {
      await saveAppPreferences(next);
      if (update.panelMode) setNotice({ tone: "info", text: update.panelMode === "floating" ? t.floatingEnabled : t.sideEnabled });
    } catch (error) { setNotice({ tone: "error", text: asMessage(error, t.unknown) }); }
  }

  async function handleExtract() {
    setBusy("extracting"); setNotice(null);
    try { const nextPost = await extractActivePost(); setPost(nextPost); setManualText(""); setCandidates([]); }
    catch (error) { setNotice({ tone: "error", text: asMessage(error, t.unknown) }); }
    finally { setBusy(null); }
  }

  async function handleGenerate() {
    if (!source) return;
    if (!provider.apiKey.trim()) { setView("settings"); setNotice({ tone: "info", text: t.needConfig }); return; }
    setBusy("generating"); setNotice(null);
    try { setCandidates(await generateReplies(source, settings)); }
    catch (error) { setNotice({ tone: "error", text: asMessage(error, t.unknown) }); }
    finally { setBusy(null); }
  }

  async function handleInsert(candidate: ReplyCandidate) {
    setBusy("inserting"); setNotice(null);
    try { await insertDraft(source?.url ?? "", candidate.text); setNotice({ tone: "success", text: t.inserted }); }
    catch (error) { setNotice({ tone: "error", text: asMessage(error, t.unknown) }); }
    finally { setBusy(null); }
  }

  async function handleCopy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice({ tone: "success", text: t.copied }); }
    catch { setNotice({ tone: "error", text: t.copyFailed }); }
  }

  async function handleProviderAction(testOnly: boolean) {
    setNotice(null);
    try {
      const allowed = await requestProviderPermission(provider.baseUrl);
      if (!allowed) throw new Error(t.permission);
      setBusy(testOnly ? "testing" : "saving");
      if (testOnly) {
        const result = await testProvider(provider);
        setNotice({ tone: "success", text: result.message });
      } else {
        await saveProviderConfig(provider);
        setProfiles((current) => ({ ...current, [provider.preset]: provider }));
        setNotice({ tone: "success", text: t.saved });
        setView("compose");
      }
    } catch (error) { setNotice({ tone: "error", text: asMessage(error, t.unknown) }); }
    finally { setBusy(null); }
  }

  async function handleLoadModels() {
    setNotice(null);
    try {
      const allowed = await requestProviderPermission(provider.baseUrl);
      if (!allowed) throw new Error(t.modelPermission);
      setBusy("models");
      const models = await listProviderModels(provider);
      setModelOptions(models);
      setProvider((current) => ({ ...current, model: models.includes(current.model) ? current.model : models[0] }));
      setNotice({ tone: "success", text: t.modelsLoaded(models.length) });
    } catch (error) { setNotice({ tone: "error", text: asMessage(error, t.unknown) }); }
    finally { setBusy(null); }
  }

  function selectProvider(preset: ProviderPreset) {
    setProfiles((current) => {
      const next = { ...current, [provider.preset]: provider };
      setProvider({ ...next[preset] });
      return next;
    });
    setModelOptions([]); setShowKey(false);
  }

  function updateCandidate(id: string, text: string) { setCandidates((items) => items.map((item) => item.id === id ? { ...item, text } : item)); }

  const languageToggle = <button className="languageToggle" type="button" aria-label={preferences.uiLanguage === "zh" ? "Switch to English" : "切换到中文"} title={preferences.uiLanguage === "zh" ? "Switch to English" : "切换到中文"} onClick={() => void updatePreferences({ uiLanguage: preferences.uiLanguage === "zh" ? "en" : "zh" })}>{preferences.uiLanguage === "zh" ? "EN" : "中"}</button>;
  const generationPhase = t.generationPhases[generationSeconds < 4 ? 0 : generationSeconds < 9 ? 1 : 2];
  const shellClass = ["shell", scrollHints.active && "isScrolling", scrollHints.top && "canScrollTop", scrollHints.bottom && "canScrollBottom"].filter(Boolean).join(" ");

  if (view === "settings") return (
    <main className={shellClass}>
      <header className="header compactHeader"><button className="backButton" type="button" onClick={() => setView("compose")} aria-label={t.back}>←</button><div className="headerTitle"><p className="eyebrow">{t.settings}</p><h1>{t.connect}</h1></div>{languageToggle}</header>
      {notice && <Notice {...notice} />}
      <section className="preferenceCard" aria-label={t.display}>
        <label className="compactField"><span>{t.panelMode}</span><select value={preferences.panelMode} onChange={(event) => void updatePreferences({ panelMode: event.target.value as PanelMode })}><option value="side">{t.side}</option><option value="floating">{t.floating}</option></select></label>
        <small>{t.floatingHint}</small>
      </section>
      <form className="form" onSubmit={(event) => { event.preventDefault(); void handleProviderAction(false); }}>
        <label className="field"><span>{t.provider}</span><select value={provider.preset} onChange={(event) => selectProvider(event.target.value as ProviderPreset)}>{providerPresets.map((preset) => <option key={preset} value={preset}>{providerLabels[preset][preferences.uiLanguage]}</option>)}</select></label>
        <label className="field"><span>{t.baseUrl}</span><input type="url" required readOnly value={provider.baseUrl} placeholder={providerHints[provider.preset].placeholder} /><small>{providerHints[provider.preset][preferences.uiLanguage]}<br />{t.actualEndpoint}: <code>{provider.baseUrl ? `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions` : "Base URL + /chat/completions"}</code></small></label>
        <label className="field"><span>{t.model}</span><div className="inputWithAction">{modelOptions.length > 0 ? <select className="modelSelect" required value={provider.model} onChange={(event) => setProvider({ ...provider, model: event.target.value })}>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select> : <input required value={provider.model} onChange={(event) => setProvider({ ...provider, model: event.target.value })} placeholder={t.modelPlaceholder} />}<button className="modelAction" type="button" disabled={busy !== null || !provider.apiKey.trim() || !provider.baseUrl.trim()} onClick={() => void handleLoadModels()}>{busy === "models" ? t.loading : t.loadModels}</button></div><small>{t.modelHelp}</small></label>
        <label className="field"><span>{t.apiKey}</span><div className="inputWithAction"><input required type={showKey ? "text" : "password"} value={provider.apiKey} onChange={(event) => setProvider({ ...provider, apiKey: event.target.value })} autoComplete="off" /><button className="keyAction" type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? t.hide : t.show}</button></div></label>
        <label className="checkField"><input type="checkbox" checked={provider.rememberKey} onChange={(event) => setProvider({ ...provider, rememberKey: event.target.checked })} /><span>{t.remember}</span></label>
        <p className="privacyHint">{t.privacy}</p>
        <div className="buttonRow"><button className="secondaryButton flexButton" type="button" disabled={busy !== null} onClick={() => void handleProviderAction(true)}>{busy === "testing" ? t.testing : t.test}</button><button className="primaryButton flexButton" type="submit" disabled={busy !== null}>{busy === "saving" ? t.saving : t.save}</button></div>
      </form>
    </main>
  );

  return (
    <main className={shellClass}>
      <header className="header"><div><p className="eyebrow">ReplyLoom</p><h1>{t.tagline}</h1></div><div className="headerActions">{languageToggle}<button className="iconButton" type="button" aria-label={t.openSettings} title={t.settings} onClick={() => { setNotice(null); setView("settings"); }}><GearIcon /></button></div></header>
      {notice && <Notice {...notice} />}
      <section className="sourceCard" aria-labelledby="source-title"><div className="sourceHeader"><p className="sectionLabel" id="source-title">{t.currentPost}</p>{post?.language && <span className="badge">{post.language.toUpperCase()}</span>}</div>{post ? <><p className="authorLine">{post.authorName ?? t.xUser} <span>{post.authorHandle}</span></p><p className="sourceText">{post.text}</p><button className="textButton" type="button" onClick={() => void handleExtract()} disabled={busy !== null}>{t.reread}</button></> : <><p className="emptyText">{t.empty}</p><button className="secondaryButton" type="button" onClick={() => void handleExtract()} disabled={busy !== null}>{busy === "extracting" ? t.reading : t.readPost}</button><details className="manualFallback"><summary>{t.manual}</summary><textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={t.paste} rows={4} /></details></>}</section>
      <section aria-labelledby="style-title"><p className="sectionLabel" id="style-title">{t.replyStyle}</p><div className="chips">{styleValues.map((value, index) => <button className={settings.style === value ? "chip active" : "chip"} type="button" key={value} onClick={() => setSettings({ ...settings, style: value })}>{t.styles[index]}</button>)}</div><div className="segmentedRow"><label className="compactField"><span>{t.length}</span><select value={settings.length} onChange={(event) => setSettings({ ...settings, length: event.target.value as GenerationSettings["length"] })}><option value="short">{t.short}</option><option value="medium">{t.medium}</option></select></label><label className="compactField"><span>{t.replyLanguage}</span><select value={settings.language} onChange={(event) => setSettings({ ...settings, language: event.target.value as GenerationSettings["language"] })}><option value="auto">{t.follow}</option><option value="zh">{t.chinese}</option><option value="en">{t.english}</option></select></label></div><button className="advancedToggle" type="button" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced}>{t.advanced} {showAdvanced ? "−" : "+"}</button>{showAdvanced && <div className="advancedPanel"><label className="field"><span>{t.voice}</span><textarea rows={2} value={settings.voiceProfile} onChange={(event) => setSettings({ ...settings, voiceProfile: event.target.value })} placeholder={t.voicePlaceholder} /></label><label className="field"><span>{t.extra}</span><textarea rows={2} value={settings.customInstruction} onChange={(event) => setSettings({ ...settings, customInstruction: event.target.value })} placeholder={t.extraPlaceholder} /></label></div>}</section>
      <button className="primaryButton" type="button" disabled={!source || busy !== null} onClick={() => void handleGenerate()}>{busy === "generating" ? t.generating : candidates.length ? t.regenerate : t.generate}</button>
      {busy === "generating" && <section className="generationProgress" role="status" aria-live="polite"><div className="generationHeading"><span className="generationOrb" aria-hidden="true"><i /><i /><i /></span><div><strong>{generationPhase}</strong><small>{t.elapsed(generationSeconds)} · {provider.model}</small></div></div><div className="generationTrack" aria-hidden="true"><span /></div><div className="draftShimmers" aria-hidden="true"><i /><i /><i /></div></section>}
      {candidates.length > 0 && <section className="candidateList" aria-labelledby="candidate-title"><p className="sectionLabel" id="candidate-title">{t.candidate}</p>{candidates.map((candidate, index) => <article className="candidateCard" key={candidate.id}><div className="candidateMeta"><span>0{index + 1}</span><span>{candidate.text.length} {t.chars}</span></div><textarea value={candidate.text} onChange={(event) => updateCandidate(candidate.id, event.target.value)} rows={4} aria-label={`${t.candidate} ${index + 1}`} /><div className="candidateActions"><button className="textButton" type="button" onClick={() => void handleCopy(candidate.text)}>{t.copy}</button><button className="insertButton" type="button" disabled={!candidate.text.trim() || busy !== null} onClick={() => void handleInsert(candidate)}><InsertIcon />{busy === "inserting" ? t.inserting : t.insert}</button></div></article>)}</section>}
      <p className="footnote">{t.footnote}</p>
    </main>
  );
}

function Notice({ tone, text }: { tone: "error" | "success" | "info"; text: string }) { return <div className={`notice ${tone}${tone === "success" ? " toast" : ""}`} role={tone === "error" ? "alert" : "status"}>{tone === "success" && <span aria-hidden="true">✓</span>}{text}</div>; }
function GearIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>; }
function InsertIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg>; }
function asMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

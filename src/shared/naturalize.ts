const CHINESE_FILLER_PREFIX = /^(?:值得一提的是|不难发现|某种程度上|在当下|从某种意义上来说|客观来说|坦白说|简单来说)[，,、\s]*/;

export function naturalizeCandidateText(text: string, languageHint: "zh" | "en") {
  const compact = text
    .trim()
    .replace(/^[“"'「]+|[”"'」]+$/g, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (languageHint !== "zh") return compact;

  return compact
    .replace(CHINESE_FILLER_PREFIX, "")
    .replace(/\s+([，。！？；：])/g, "$1")
    .replace(/([，。！？；：])\s+/g, "$1")
    .replace(/([！？])\1+/g, "$1")
    .replace(/([。])\1+/g, "$1")
    .trim();
}

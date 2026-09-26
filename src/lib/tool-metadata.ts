// Preserve complete, genuinely localized sentences; do not pad to a keyword/character target.
export function toolMetaDescription(copy: { description?: string; intro?: string; paragraphs?: string[] } | undefined, fallback: string, locale: string) {
  const text = copy?.paragraphs?.[0]?.trim() || copy?.intro?.trim() || copy?.description?.trim() || fallback;
  const language = locale === 'zh-cn' || locale === 'zh-tw' ? 'zh' : locale;
  const sentences = [...new Intl.Segmenter(language, { granularity: 'sentence' }).segment(text)].map(item => item.segment.trim());
  let result = sentences[0] || text;
  for (const sentence of sentences.slice(1)) {
    if (result.length + sentence.length + 1 > 190) break;
    result += ` ${sentence}`;
  }
  return result;
}

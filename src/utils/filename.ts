const graphemes = (value: string) => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), part => part.segment);
  }
  return Array.from(value);
};

export const shortenFilename = (filename: string, maxLength = 42) => {
  const characters = graphemes(filename);
  if (characters.length <= maxLength) return filename;

  const dotIndex = filename.lastIndexOf('.');
  const hasExtension = dotIndex > 0 && filename.length - dotIndex <= 12;
  const extension = hasExtension ? filename.slice(dotIndex) : '';
  const stem = hasExtension ? filename.slice(0, dotIndex) : filename;
  const stemCharacters = graphemes(stem);
  const extensionCharacters = graphemes(extension);
  const available = Math.max(10, maxLength - extensionCharacters.length - 1);
  const beginning = Math.max(6, Math.ceil(available * 0.62));
  const ending = Math.max(4, available - beginning);

  return `${stemCharacters.slice(0, beginning).join('')}…${stemCharacters.slice(-ending).join('')}${extension}`;
};

export const setDisplayedFilename = (element: HTMLElement, filename: string, maxLength = 42) => {
  element.textContent = shortenFilename(filename, maxLength);
  element.title = filename;
  element.setAttribute('aria-label', filename);
};

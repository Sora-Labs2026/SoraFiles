export const POPULARITY_LIMIT = 10;
export const POPULARITY_MINIMUM_EVENTS = 100;

// Evidence-informed cold-start order only. Once the minimum real-success
// threshold is met, the daily aggregate ranking replaces this order.
export const POPULARITY_BOOTSTRAP_CANDIDATES = [
  'compress-pdf',
  'compress-image',
  'merge-pdf',
  'split-pdf',
  'jpg-to-pdf',
  'pdf-to-jpg',
  'pdf-to-word',
  'word-to-pdf',
  'heic-to-jpg',
  'image-converter',
];

export const POPULARITY_SIGNAL_WEIGHTS = Object.freeze({
  success7: 0.45,
  success30: 0.20,
  searchConsole: 0.20,
  marketDemand: 0.15,
});

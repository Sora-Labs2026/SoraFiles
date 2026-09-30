// Product availability, independent of engine readiness and license tier.
// Unlock PDF is intentionally excluded from Desktop and Dodo-powered offerings.
// Keep the free Web registry and engine independent of this Desktop policy.
export const desktopToolIds = Object.freeze([
  'compress-pdf', 'merge-pdf', 'split-pdf', 'rotate-pdf', 'remove-pages',
  'pdf-to-jpg', 'jpg-to-pdf', 'pdf-to-word', 'word-to-pdf', 'watermark-pdf',
  'page-numbers', 'sign-pdf', 'image-converter', 'compress-image', 'heic-to-jpg',
  'edit-image', 'remove-background', 'protect-pdf', 'repair-pdf',
  'metadata-remover', 'pdf-to-excel', 'excel-to-pdf', 'pdf-ocr', 'resize-image',
  'doc-scanner',
]);
const allowed = new Set(desktopToolIds);
export const isDesktopTool = id => typeof id === 'string' && allowed.has(id);
export function assertDesktopTool(id) {
  if (!isDesktopTool(id)) throw Error('Tool is not available in Desktop');
}

// A process grant authorizes only the product allowlist, never arbitrary tools.
export const desktopEntitlementFeatures = Object.freeze(['process']);
export function validDesktopFeatures(features) {
  return Array.isArray(features) && features.length === 1 && features[0] === 'process';
}

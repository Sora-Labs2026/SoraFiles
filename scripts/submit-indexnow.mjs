// Compatibility entry point: shared production filtering and failure handling.
if (!process.argv.includes('--live') && !process.argv.includes('--dry-run')) {
  throw new Error('Choose --dry-run to validate locally or --live to submit the production sitemap.');
}
process.argv.push('--indexnow-only');
await import('./ping-search-engines.js');
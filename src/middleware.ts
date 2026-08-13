import { defineMiddleware } from 'astro:middleware';

// Routes are generated explicitly in src/pages/[locale]/[...path].astro.
// Keep middleware intentionally transparent so language selection remains a user choice.
export const onRequest = defineMiddleware((_context, next) => next());

// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

const contentLastModified = '2026-08-11';
const localeRootPattern = /^\/(?:ja|ko|es|fr|de|pt|zh-cn|zh-tw|hi|ar|ru|id|it|nl|tr|vi|th|pl)\/$/;

// https://astro.build/config
export default defineConfig({
  site: 'https://sorafiles.com',
  i18n: {
    defaultLocale: 'en',
    locales: [
      'en', 'ja', 'ko', 'es', 'fr', 'de', 'pt',
      { path: 'zh-cn', codes: ['zh-Hans', 'zh-CN'] },
      { path: 'zh-tw', codes: ['zh-Hant', 'zh-TW'] },
      'hi', 'ar', 'ru', 'id', 'it', 'nl', 'tr', 'vi', 'th', 'pl',
    ],
    routing: 'manual',
  },
  integrations: [sitemap({
    filter: (page) => !page.endsWith('/heic/'),
    serialize(item) {
      const pathname = new URL(item.url).pathname;
      if (item.url !== 'https://sorafiles.com/' && !localeRootPattern.test(pathname)) item.url = item.url.replace(/\/$/, '');
      item.lastmod = contentLastModified;
      return item;
    },
    namespaces: { news: false, xhtml: false, video: false },
  })],
  vite: {
    plugins: [tailwindcss()]
  }
});

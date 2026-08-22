// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

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
  vite: {
    plugins: [tailwindcss()]
  }
});

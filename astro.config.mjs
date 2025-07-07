// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import solidJs from '@astrojs/solid-js';
import node from '@astrojs/node';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO : Change this to your site URL
  site: 'https://your.site',

  integrations: [sitemap(), partytown(), solidJs(), icon()],

  i18n: {
    locales: ["en", "fr", "es", "jp"], // TODO : Add your locales
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false
    }
  },

  output: 'server',

  adapter: node({
    mode: 'standalone'
  }),

  vite: {
    plugins: [tailwindcss()]
  }
});
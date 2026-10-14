import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default defineConfig(context => mergeConfig(viteConfig(context), {
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    restoreMocks: true,
    unstubGlobals: true,
  },
}));

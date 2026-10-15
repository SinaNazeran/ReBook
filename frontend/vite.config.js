import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { hostHeaderArtifacts, parseHostHeaders, securityHeaders } from './security-headers'
import { siteOrigin } from './src/utils/canonicals.js'

// https://vite.dev/config/
export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL;
  if (command === 'build' && !apiUrl) throw new Error('VITE_API_URL is required for production builds.');
  siteOrigin(process.env.VITE_SITE_URL || env.VITE_SITE_URL, { required: command === 'build' });
  const hostPolicy = isPreview ? readFileSync(resolve(process.cwd(), 'dist/_headers'), 'utf8') : '';
  const headers = isPreview
    ? parseHostHeaders(hostPolicy)
    : securityHeaders(apiUrl || 'http://localhost:8000/api', { production: command === 'build' });
  return {
    plugins: [react(), {
      name: 'security-header-artifacts',
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle).map(name => `/${name}`);
        for (const [fileName, source] of Object.entries(hostHeaderArtifacts(headers, assets))) {
          this.emitFile({ type: 'asset', fileName, source });
        }
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = new URL(req.url, 'http://localhost').pathname;
          const policy = parseHostHeaders(hostPolicy, path)['Cache-Control'] ?? 'no-cache';
          res.setHeader('Cache-Control', policy);
          next();
        });
      },
    }],
    preview: { headers: Object.fromEntries(Object.entries(headers).filter(([key]) => key !== 'Cache-Control')) },
  };
})

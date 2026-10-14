import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { hostHeaderArtifacts, parseHostHeaders, securityHeaders } from './security-headers'

// https://vite.dev/config/
export default defineConfig(({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL;
  if (command === 'build' && !apiUrl) throw new Error('VITE_API_URL is required for production builds.');
  const headers = isPreview
    ? parseHostHeaders(readFileSync(resolve(process.cwd(), 'dist/_headers'), 'utf8'))
    : securityHeaders(apiUrl || 'http://localhost:8000/api', { production: command === 'build' });
  return {
    plugins: [react(), {
      name: 'security-header-artifacts',
      generateBundle() {
        for (const [fileName, source] of Object.entries(hostHeaderArtifacts(headers))) {
          this.emitFile({ type: 'asset', fileName, source });
        }
      },
    }],
    preview: { headers },
  };
})

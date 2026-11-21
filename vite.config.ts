import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGitHubPages = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGitHubPages ? '/Ventora-Connect/' : '/',
  plugins: [react()],
});

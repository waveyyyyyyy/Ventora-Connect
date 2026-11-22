import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGitHubPages = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGitHubPages ? '/Ventora-Connect/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
        }
      }
    }
  }
});

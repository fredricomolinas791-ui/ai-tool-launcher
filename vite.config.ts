import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev-only reverse proxy: many AI providers (notably MiniMax, DeepSeek,
  // Moonshot, Volcengine Ark) don't return CORS headers wide enough for
  // direct browser calls, so the test-connection call dies with
  // "Failed to fetch" before even reaching the server. Proxying through
  // the dev server sidesteps the browser CORS check entirely.
  // Usage in the UI: set baseURL to "/proxy/minimaxi/anthropic/v1" and
  // Vite forwards it to https://api.minimaxi.com/anthropic/v1.
  server: {
    proxy: {
      '/proxy/minimaxi': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy\/minimaxi/, ''),
      },
      '/proxy/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/deepseek/, ''),
      },
      '/proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/openai/, ''),
      },
      '/proxy/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/anthropic/, ''),
      },
    },
  },
  build: {
    // Increase the chunk-size warning limit so a few tool-heavy chunks
    // don't fail the build; the manualChunks below keeps the main bundle
    // small (currently ~200KB) even though auxiliary chunks can be larger.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split the heavy tool component files into separate chunks so
        // the initial bundle only loads the shell. Each category becomes
        // its own chunk, lazy-loaded the first time the user opens a tool
        // from that category.
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          }
          if (id.includes('/src/components/life/')) return 'tools-life';
          if (id.includes('/src/components/text/')) return 'tools-text';
          if (id.includes('/src/components/media/')) return 'tools-media';
          if (id.includes('/src/components/productivity/')) return 'tools-productivity';
          if (id.includes('/src/components/Settings/')) return 'settings';
          if (id.includes('/src/lib/')) return 'lib';
          if (id.includes('/src/hooks/')) return 'hooks';
        },
      },
    },
  },
})

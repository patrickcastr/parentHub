import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Allow overriding API target via env; default to local backend.
// Prefer explicit 127.0.0.1 to avoid ::1 IPv6 mismatch on some Windows setups.
const apiTarget = process.env.VITE_API_URL || 'http://127.0.0.1:5180';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  }
});
import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; import wails from '@wailsio/runtime/plugins/vite'; import path from 'node:path';
export default defineConfig({ resolve: { alias: { '@': path.resolve(__dirname, 'src') } }, server: { host: '127.0.0.1', port: Number(process.env.WAILS_VITE_PORT) || 9245, strictPort: true }, plugins: [react(), wails('./bindings')] });

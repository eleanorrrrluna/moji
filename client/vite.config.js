import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 开发时，前端页面在 5173 端口，后端在 3001；
    // 这个代理让页面里的 /api 请求自动转发给后端，两边像一个整体
    proxy: {
      '/api': 'http://127.0.0.1:3611',
    },
  },
});

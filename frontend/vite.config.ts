import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const backendPaths = [
  '/auth',
  '/users',
  '/trips',
  '/payments',
  '/seats',
  '/rooms',
  '/buses',
  '/health',
]

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    environment.API_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      proxy: Object.fromEntries(
        backendPaths.map((path) => [
          path,
          {
            target: proxyTarget,
            changeOrigin: true,
          },
        ]),
      ),
    },
  }
})

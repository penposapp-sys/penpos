import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  return {
    server: {
      host: true,
      port: 5173
    },
    build: {
      sourcemap: isProd ? false : true
    },
    esbuild: isProd ? { drop: ['console', 'debugger'] } : {}
  }
})

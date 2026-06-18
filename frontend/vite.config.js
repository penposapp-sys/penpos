import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    server: {
      host: true,
      port: 5173
    },
    build: {
      sourcemap: mode !== 'production'
    },
    esbuild: mode === 'production' ? { drop: ['debugger'] } : {}
  }
})

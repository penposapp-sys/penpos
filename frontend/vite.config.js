import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    define: {
      'process.env': {},
      process: { env: {} }
    },
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

import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    define: {
      'process.env': {},
      process: { env: {} }
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api/call-agents': {
          target: 'http://127.0.0.1:4000',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyRequest, request) => {
              const remoteAddress = String(request.socket?.remoteAddress || '').replace(/^::ffff:/i, '').toLowerCase()
              proxyRequest.removeHeader('x-forwarded-proto')
              if (remoteAddress === '127.0.0.1' || remoteAddress === '::1') {
                proxyRequest.setHeader('x-forwarded-proto', 'https')
              }
            })
          }
        }
      }
    },
    build: {
      sourcemap: mode !== 'production'
    },
    esbuild: mode === 'production' ? { drop: ['debugger'] } : {}
  }
})

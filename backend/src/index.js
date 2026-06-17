import { createServer } from './app.js'
import { connectDB } from './config/db.js'
import { seedSuperadmin } from './config/seed.js'
import mongoose from 'mongoose'
import * as logger from './utils/logger.js'
import dotenv from 'dotenv'
import os from 'os'
import { startProductImageCleanupScheduler } from './services/productImageCleanupService.js'

dotenv.config()

const PORT = Number(process.env.PORT) || 4000
const HOST = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0'
if (PORT !== 4000) {
  logger.error(`❌ HATA: Backend portu sadece 4000 olabilir (PORT=${process.env.PORT})`)
  process.exit(1)
}

const pickLanIp = () => {
  try {
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets || {})) {
      for (const n of (nets[name] || [])) {
        if (!n) continue
        if (n.family !== 'IPv4') continue
        if (n.internal) continue
        const addr = String(n.address || '').trim()
        if (addr) return addr
      }
    }
  } catch {
  }
  return ''
}

const start = async () => {
  await connectDB()
  await seedSuperadmin()
  const app = createServer()
  const server = app.listen(PORT, HOST, () => {
    const lanIp = pickLanIp()
    const hostLabel = HOST === '0.0.0.0' ? '0.0.0.0 (LAN erişimi açık)' : HOST
    logger.info(`[SERVER] Backend listening on ${hostLabel}:${PORT}`)
    logger.info(`[SERVER] Health: http://127.0.0.1:${PORT}/api/health`)
    if (lanIp) logger.info(`[SERVER] Health (LAN): http://${lanIp}:${PORT}/api/health`)
  })
  startProductImageCleanupScheduler()

  const shutdown = async (code = 1) => {
    try {
      logger.warn('Shutting down gracefully...')
      server.close(() => {
        logger.info('HTTP server closed')
      })
      await mongoose.disconnect().catch(() => {})
    } finally {
      process.exit(code)
    }
  }

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err?.message)
    shutdown(1)
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason?.message || String(reason))
    shutdown(1)
  })
}

start()

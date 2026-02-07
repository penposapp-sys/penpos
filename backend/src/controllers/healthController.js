import mongoose from 'mongoose'

export const healthController = async (req, res) => {
  const uptime = Math.floor(process.uptime())
  const env = process.env.NODE_ENV || 'development'
  const ready = mongoose.connection?.readyState === 1
  const status = ready ? 'ok' : 'degraded'
  res.json({ status, uptime, env })
}

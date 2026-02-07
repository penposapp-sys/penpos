import mongoose from 'mongoose'

let cached = null
let inFlight = null

const detectOnce = async () => {
  if (cached !== null) return cached
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      if (!mongoose.connection?.db) {
        cached = false
        return cached
      }
      const admin = mongoose.connection.db.admin()
      let info
      try {
        info = await admin.command({ hello: 1 })
      } catch {
        info = await admin.command({ isMaster: 1 })
      }
      const supported = !!info?.setName || info?.msg === 'isdbgrid'
      cached = supported
      return cached
    } catch {
      cached = false
      return cached
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export const isTxnSupported = async () => detectOnce()

export const resetTxnSupportCache = () => {
  cached = null
  inFlight = null
}


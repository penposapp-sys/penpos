import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import { close } from '../src/controllers/posController.js'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_saas'
  await mongoose.connect(MONGODB_URI)

  const req = {
    params: { id: 'undefined' },
    user: { tenantId: 't', id: 'u' },
  }
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.payload = data
      return this
    }
  }

  await close(req, res)
  must(res.statusCode === 400, `Expected 400, got ${res.statusCode}`)
  must(res.payload?.code === 'invalid_order_id', 'Expected code invalid_order_id')
  console.log(JSON.stringify({ pass: true }, null, 2))
  await mongoose.disconnect()
}

main().catch(async (e) => {
  try {
    console.error('FAILED', e?.message || e)
  } finally {
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  }
})

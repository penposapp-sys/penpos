import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import User from '../src/models/User.js'
import { login } from '../src/services/authService.js'

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const must = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const user = await User.findOne({ role: 'platform_admin' }).lean()
  must(user, 'platform_admin user must exist (run tools/platform-seed-admin.mjs)')

  const res = await login(' PLATFORM@ADMIN.COM ', 'Admin12345!', 'platform', { requestId: 'e2e-platform-login' })
  must(!!res?.token, 'token must be returned')
  must(res?.user?.role === 'platform_admin', 'role must be platform_admin')

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


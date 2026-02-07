import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import User from '../src/models/User.js'

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const main = async () => {
  const email = 'platform@admin.com'
  const password = 'Admin12345!'

  await mongoose.connect(MONGODB_URI)

  const passwordHash = await bcrypt.hash(password, 10)
  const filter = { role: 'platform_admin' }
  const update = {
    $set: {
      tenantId: null,
      branchId: null,
      name: 'Platform Admin',
      email: email.toLowerCase(),
      passwordHash,
      role: 'platform_admin',
      isActive: true
    }
  }
  const opts = { upsert: true, new: true, setDefaultsOnInsert: true }
  const user = await User.findOneAndUpdate(filter, update, opts)

  console.log('Platform admin hazır:', { email: user.email, id: user.id })
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


import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { connectDB } from './db.js'
import User from '../models/User.js'

dotenv.config()

const run = async () => {
  const emailArg = process.argv[2] || process.env.PLATFORM_ADMIN_EMAIL
  const passwordArg = process.argv[3] || process.env.PLATFORM_ADMIN_PASSWORD
  if (!emailArg || !passwordArg) {
    console.error('Usage: node src/config/setPlatformAdmin.js <email> <password>')
    process.exit(1)
  }
  await connectDB()
  const passwordHash = await bcrypt.hash(passwordArg, 10)
  let user = await User.findOne({ role: 'platform_admin' })
  if (user) {
    user.email = emailArg
    user.passwordHash = passwordHash
    user.isActive = true
    await user.save()
    console.log('Platform admin updated:', user.email)
  } else {
    user = await User.create({
      tenantId: null,
      branchId: null,
      name: 'Platform Admin',
      email: emailArg,
      passwordHash,
      role: 'platform_admin',
      isActive: true
    })
    console.log('Platform admin created:', user.email)
  }
  process.exit(0)
}

run().catch(err => {
  console.error('Failed to set platform admin:', err?.message || err)
  process.exit(1)
})

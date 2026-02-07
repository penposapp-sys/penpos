import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { connectDB } from '../src/config/db.js'
import User from '../src/models/User.js'

dotenv.config()

const getArg = (name) => {
  const idx = process.argv.findIndex(x => x === `--${name}`)
  if (idx < 0) return null
  return process.argv[idx + 1] || null
}

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const main = async () => {
  const email = String(getArg('email') || '').trim().toLowerCase()
  const password = String(getArg('password') || '')
  if (!email) throw new Error('Missing --email')
  if (!password) throw new Error('Missing --password')

  await connectDB()
  if (mongoose.connection?.readyState !== 1) {
    throw new Error('MongoDB not connected')
  }

  const user = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') })
  if (!user) {
    console.error('User not found')
    process.exit(1)
  }
  user.passwordHash = await bcrypt.hash(password, 10)
  await user.save()
  console.log('OK')
}

main()
  .then(() => mongoose.disconnect().catch(() => {}))
  .catch(async (err) => {
    console.error(err)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  })

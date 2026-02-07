import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { hasAnySuperadmin, createUser } from '../repositories/userRepository.js'

dotenv.config()

export const seedSuperadmin = async () => {
  const exists = await hasAnySuperadmin()
  if (exists) return
  const email = process.env.SUPERADMIN_EMAIL
  const password = process.env.SUPERADMIN_PASSWORD
  if (!email || !password) return
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await createUser({
    tenantId: null,
    name: 'Super Admin',
    email,
    passwordHash,
    role: 'superadmin',
    isActive: true
  })
  console.log('Superadmin seeded', user.email)
}

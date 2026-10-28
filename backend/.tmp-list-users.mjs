import dotenv from 'dotenv'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import path from 'node:path'

dotenv.config({ path: 'C:/Users/faruk/Documents/PenPos System/penpos dosyalar/PenPos/backend/.env' })

await mongoose.connect(process.env.MONGODB_URI)

const users = await mongoose.connection.db.collection('users')
  .find({ systemType: 'kermes' })
  .project({ name: 1, email: 1, username: 1, role: 1, tenantId: 1, branchId: 1, permissions: 1 })
  .limit(20)
  .toArray()

console.log(JSON.stringify(users.map(u => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  username: u.username,
  role: u.role,
  tenantId: u.tenantId ? String(u.tenantId) : null,
  branchId: u.branchId ? String(u.branchId) : null,
  permissions: u.permissions
})), null, 2))

await mongoose.disconnect()

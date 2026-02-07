import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { connectDB } from '../src/config/db.js'
import Tenant from '../src/models/Tenant.js'
import Branch from '../src/models/Branch.js'
import User from '../src/models/User.js'

dotenv.config()

const getArg = (name) => {
  const idx = process.argv.findIndex(x => x === `--${name}`)
  if (idx < 0) return null
  return process.argv[idx + 1] || null
}

const main = async () => {
  const email = String(getArg('email') || process.env.RESTAURANT_ADMIN_EMAIL || 'kermes@penpos.com').trim().toLowerCase()
  const password = String(getArg('password') || process.env.RESTAURANT_ADMIN_PASSWORD || 'Admin12345!')
  const tenantSlug = String(getArg('tenantSlug') || process.env.RESTAURANT_TENANT_SLUG || 'kermes-demo').trim().toLowerCase()
  const tenantName = String(getArg('tenantName') || process.env.RESTAURANT_TENANT_NAME || 'Kermes Demo').trim() || 'Kermes Demo'
  const branchName = String(getArg('branchName') || process.env.RESTAURANT_BRANCH_NAME || 'Merkez').trim() || 'Merkez'

  if (!email) throw new Error('Email required')
  if (!password) throw new Error('Password required')

  await connectDB()
  if (mongoose.connection?.readyState !== 1) {
    throw new Error('MongoDB not connected')
  }

  let tenant = await Tenant.findOne({ slug: tenantSlug })
  if (!tenant) {
    tenant = await Tenant.create({
      name: tenantName,
      slug: tenantSlug,
      description: '',
      logoUrl: '',
      allowedBranchIds: [],
      systemType: 'kermes',
      status: 'active',
      isActive: true,
      createdAt: new Date()
    })
  }

  let branch = await Branch.findOne({ tenantId: tenant._id, name: branchName })
  if (!branch) {
    branch = await Branch.create({
      tenantId: tenant._id,
      name: branchName,
      description: '',
      address: '',
      isActive: true
    })
  }

  const allowed = new Set((tenant.allowedBranchIds || []).map(x => String(x)))
  allowed.add(String(branch._id))
  tenant.allowedBranchIds = Array.from(allowed)
  await tenant.save()

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.findOneAndUpdate(
    { email: new RegExp(`^${email.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`, 'i') },
    {
      $set: {
        tenantId: tenant._id,
        branchId: branch._id,
        branchIds: [branch._id],
        systemType: 'kermes',
        name: 'Restaurant Admin',
        email,
        passwordHash,
        role: 'tenant_admin',
        isActive: true,
        permissions: []
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true, new: true }
  )

  console.log(`Restaurant admin hazır: ${user.email} / ${password}`)
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`)
  console.log(`Branch: ${branch.name} (${String(branch._id)})`)
}

main()
  .then(() => mongoose.disconnect().catch(() => {}))
  .catch(async (err) => {
    console.error(err)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  })

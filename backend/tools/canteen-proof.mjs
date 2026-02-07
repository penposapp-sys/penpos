import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

dotenv.config({ path: new URL('../.env', import.meta.url) })

import Tenant from '../src/models/Tenant.js'
import User from '../src/models/User.js'
import CanteenBranch from '../src/modules/canteen/models/CanteenBranch.js'

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const main = async () => {
  const tenantSlug = 'kantin-proof'
  const tenantName = 'Kantin Proof'

  const email = 'kantin.admin@example.com'
  const password = 'kantin123'

  await mongoose.connect(MONGODB_URI)

  const tenant = await Tenant.findOneAndUpdate(
    { slug: tenantSlug },
    {
      $set: {
        name: tenantName,
        slug: tenantSlug,
        isActive: true,
        status: 'active',
        systemType: 'kantin'
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    {
      $set: {
        tenantId: tenant.id,
        branchId: null,
        name: 'Kantin Admin',
        email: email.toLowerCase(),
        passwordHash,
        role: 'tenant_admin',
        isActive: true,
        systemType: 'kantin',
        permissions: [
          'canteen_pos_access',
          'canteen_settings_manage',
          'canteen_catalog_manage',
          'canteen_staff_manage',
          'canteen_sales_view'
        ]
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  const canteenBranch = await CanteenBranch.findOneAndUpdate(
    { tenantId: tenant.id, nameNormalized: 'merkez' },
    {
      $set: {
        tenantId: tenant.id,
        name: 'Merkez',
        nameNormalized: 'merkez',
        isActive: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  console.log('Kantin proof hazır:', {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    email: user.email,
    password,
    canteenBranchId: canteenBranch.id
  })

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


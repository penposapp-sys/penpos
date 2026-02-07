import dotenv from 'dotenv'
import mongoose from 'mongoose'
import readline from 'readline'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

import Tenant from '../src/models/Tenant.js'
import User from '../src/models/User.js'
import Branch from '../src/models/Branch.js'

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('MongoDB Connected')
  } catch (err) {
    console.error('MongoDB Connection Error:', err)
    process.exit(1)
  }
}

const report = async () => {
  console.log('\n--- Market Cleanup Report ---\n')

  const tenants = await Tenant.countDocuments({ systemType: { $regex: /market/i } })
  console.log(`Tenants with systemType 'market': ${tenants}`)

  const users = await User.countDocuments({ systemType: { $regex: /market/i } })
  console.log(`Users with systemType 'market': ${users}`)

  // Branch might not have systemType anymore, but checking just in case
  const branches = await Branch.countDocuments({ systemType: { $regex: /market/i } })
  console.log(`Branches with systemType 'market': ${branches}`)

  return { tenants, users, branches }
}

const cleanup = async () => {
  console.log('\n--- Performing Cleanup ---\n')

  const tRes = await Tenant.deleteMany({ systemType: { $regex: /market/i } })
  console.log(`Deleted ${tRes.deletedCount} Tenants`)

  const uRes = await User.deleteMany({ systemType: { $regex: /market/i } })
  console.log(`Deleted ${uRes.deletedCount} Users`)

  const bRes = await Branch.deleteMany({ systemType: { $regex: /market/i } })
  console.log(`Deleted ${bRes.deletedCount} Branches`)

  console.log('\nCleanup Completed.')
}

const main = async () => {
  await connectDB()
  const counts = await report()

  if (counts.tenants === 0 && counts.users === 0 && counts.branches === 0) {
    console.log('\nNo market data found. System is clean.')
    process.exit(0)
  }

  if (process.argv.includes('--force')) {
    await cleanup()
    process.exit(0)
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question('\nDo you want to DELETE all market data? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
      await cleanup()
    } else {
      console.log('Operation cancelled.')
    }
    rl.close()
    process.exit(0)
  })
}

main()

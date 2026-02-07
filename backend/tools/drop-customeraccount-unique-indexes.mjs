import dotenv from 'dotenv'
import mongoose from 'mongoose'
import CustomerAccount from '../src/models/CustomerAccount.js'

dotenv.config()

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const hasNameOrPhoneKey = (idx) => {
  const keys = idx?.key && typeof idx.key === 'object' ? Object.keys(idx.key) : []
  return keys.some(k => /name|phone/i.test(String(k)))
}

try {
  await mongoose.connect(uri)

  const collectionName = CustomerAccount.collection.name
  const collection = mongoose.connection.db.collection(collectionName)
  const indexes = await collection.indexes()

  const targets = (indexes || [])
    .filter(i => i && i.name && i.name !== '_id_' && i.unique === true)
    .filter(i => hasNameOrPhoneKey(i))

  if (targets.length === 0) {
    console.log('[drop-indexes] No matching unique indexes found')
    console.log('DONE')
    process.exit(0)
  }

  for (const idx of targets) {
    console.log('[drop-indexes] Dropping', { name: idx.name, key: idx.key })
    await collection.dropIndex(idx.name)
  }

  console.log('DONE')
  process.exit(0)
} catch (err) {
  console.error('[drop-indexes] FAILED', err?.message || err)
  process.exit(1)
}

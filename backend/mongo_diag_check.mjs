import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const uri = process.env.MONGODB_URI || process.env.MONGO_URI

if (!uri) {
  console.log(JSON.stringify({
    status: 'FAIL',
    reason: 'No MongoDB URI configured in runtime env'
  }, null, 2))
  process.exit(0)
}

const run = async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
    const state = mongoose.connection.readyState
    const db = mongoose.connection.db
    const collection = db.collection('anaokuluschools')
    const doc = await collection.findOne(
      { 'invoices.no': 'PDK2026000000160' },
      { projection: { _id: 0, tenant: 1, 'invoices.no': 1, 'invoices.date': 1, 'invoices.total': 1 } }
    )

    const matches = Array.isArray(doc?.invoices)
      ? doc.invoices.filter((inv) => inv && inv.no === 'PDK2026000000160')
      : []

    console.log(JSON.stringify({
      status: 'PASS',
      readyState: state,
      connectedHost: mongoose.connection.host || null,
      dbName: mongoose.connection.name || null,
      foundSchool: !!doc,
      matchCount: matches.length,
      invoice: matches[0] || null
    }, null, 2))
  } catch (err) {
    console.log(JSON.stringify({
      status: 'FAIL',
      readyState: mongoose.connection.readyState,
      reason: err?.message || String(err)
    }, null, 2))
  } finally {
    await mongoose.disconnect().catch(() => {})
  }
}

run()

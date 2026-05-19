import 'dotenv/config'
import mongoose from 'mongoose'
import Plan from '../src/models/Plan.js'
import User from '../src/models/User.js'
import { buildPlanTypeMatchQuery, buildTrialMatchQuery, normalizeSystemType } from '../src/utils/systemType.js'

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_saas'

const normalizePlanDocument = async (collection, doc) => {
  const normalizedType = normalizeSystemType(
    doc?.packageType ||
    doc?.vertical ||
    doc?.systemType ||
    doc?.system ||
    doc?.type ||
    doc?.Sistem
  )

  const hasTrialHint =
    doc?.isTrial === true ||
    Number(doc?.trialDays || 0) === 7 ||
    Number(doc?.trialDurationDays || 0) === 7 ||
    Number(doc?.trialPeriodDays || 0) === 7 ||
    /7\s*gun|deneme|trial/i.test(String(doc?.name || ''))

  const next = {}
  if (normalizedType) {
    next.systemType = normalizedType
    next.packageType = normalizedType
    next.vertical = normalizedType
    next.system = normalizedType
    next.type = normalizedType
  }

  if (hasTrialHint) {
    next.isTrial = true
    next.trialDays = 7
    next.isActive = true
  }

  if (Object.keys(next).length > 0) {
    await collection.updateOne({ _id: doc._id }, { $set: next })
  }
}

const ensureTrialPlan = async ({ normalizedType, name }) => {
  const plan = await Plan.findOne({
    $and: [
      { isActive: true },
      { $or: buildPlanTypeMatchQuery(normalizedType) },
      { $or: buildTrialMatchQuery() }
    ]
  }).setOptions({ strictQuery: false })

  if (plan) {
    plan.systemType = normalizedType
    plan.packageType = normalizedType
    plan.vertical = normalizedType
    plan.isTrial = true
    plan.trialDays = 7
    plan.isActive = true
    if (!plan.name) plan.name = name
    await plan.save()
    return { id: plan.id, created: false }
  }

  const created = await Plan.create({
    systemType: normalizedType,
    packageType: normalizedType,
    vertical: normalizedType,
    name,
    price: 0,
    limits: { products: -1, tables: -1, staff: -1 },
    features: { reports: true, kitchen: normalizedType === 'restaurant' },
    trialDays: 7,
    isTrial: true,
    isActive: true
  })
  return { id: created.id, created: true }
}

const main = async () => {
  await mongoose.connect(MONGODB_URI)

  const planCollection = mongoose.connection.db.collection('plans')
  const docs = await planCollection.find({}).toArray()
  for (const doc of docs) {
    await normalizePlanDocument(planCollection, doc)
  }

  const restaurant = await ensureTrialPlan({
    normalizedType: 'restaurant',
    name: 'Restoran 7 Gunluk Deneme'
  })

  const canteen = await ensureTrialPlan({
    normalizedType: 'canteen',
    name: 'Kantin 7 Gunluk Deneme'
  })

  const userCollection = mongoose.connection.db.collection('users')
  const indexes = await userCollection.indexes()
  const emailUnique = indexes.find((idx) => idx.unique && idx.key && idx.key.email === 1 && Object.keys(idx.key).length === 1)
  if (emailUnique) {
    await userCollection.dropIndex(emailUnique.name)
  }
  await User.syncIndexes()

  console.log(JSON.stringify({ ok: true, restaurant, canteen, normalizedPlans: docs.length }, null, 2))
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  try { await mongoose.disconnect() } catch {}
  process.exit(1)
})

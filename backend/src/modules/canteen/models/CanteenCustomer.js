import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: false, default: null, index: true },
  name: { type: String, required: true },
  nameNormalized: { type: String, required: true, index: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  note: { type: String, default: '' },
  passwordHash: { type: String, default: '' },
  favoriteProductIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'CanteenProduct', default: [] },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { collection: 'canteen_customers' })

schema.index({ tenantId: 1, nameNormalized: 1 })
schema.index({ tenantId: 1, phone: 1 })

export default mongoose.model('CanteenCustomer', schema)

import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  nameNormalized: { type: String, required: true, index: true },
  publicSlug: { type: String, default: '', index: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'canteen_branches' })

schema.index({ tenantId: 1, nameNormalized: 1 }, { unique: true })
schema.index({ publicSlug: 1 }, { unique: true, sparse: true })

export default mongoose.model('CanteenBranch', schema)

import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  name: { type: String, required: true },
  nameNormalized: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  sortOrder: { type: Number, default: 0, index: true },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'canteen_categories' })

schema.index({ tenantId: 1, branchId: 1, nameNormalized: 1 }, { unique: true })

export default mongoose.model('CanteenCategory', schema)

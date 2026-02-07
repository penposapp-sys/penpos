import mongoose from 'mongoose'

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  allowedBranchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] },
  systemType: { type: String, enum: ['kermes', 'kantin'], default: 'kermes', required: true },
  settings: {
    qrMenuEnabled: { type: Boolean, default: true }
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  isActive: { type: Boolean, default: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null, index: true },
  planStartedAt: { type: Date, default: null },
  planEndsAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
})

tenantSchema.index({ isActive: 1 })
tenantSchema.index({ status: 1 })

export default mongoose.model('Tenant', tenantSchema)

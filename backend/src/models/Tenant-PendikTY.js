import mongoose from 'mongoose'

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  phone: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  allowedBranchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] },
  systemType: { type: String, enum: ['kermes', 'kantin'], default: 'kermes', required: true },
  vertical: { type: String, enum: ['restaurant', 'canteen'], default: 'restaurant', required: true, index: true },
  businessType: { type: String, enum: ['restaurant', 'canteen'], default: 'restaurant' },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  settings: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  isActive: { type: Boolean, default: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null, index: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null, index: true },
  planStartedAt: { type: Date, default: null },
  planEndsAt: { type: Date, default: null },
  trialStartsAt: { type: Date, default: null },
  trialEndsAt: { type: Date, default: null },
  subscriptionStatus: { type: String, enum: ['trial', 'active', 'expired', 'inactive'], default: 'inactive', index: true },
  createdAt: { type: Date, default: Date.now }
})

tenantSchema.index({ isActive: 1 })
tenantSchema.index({ status: 1 })
tenantSchema.index({ ownerUserId: 1, vertical: 1 })

export default mongoose.model('Tenant', tenantSchema)

import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  defaultBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', default: null },
  canteenAllowedBranchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'CanteenBranch', default: [] },
  canteenDefaultBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', default: null },
  defaultVatRate: { type: Number, default: 0 },
  receiptHeader: { type: String, default: '' },
  receiptFooter: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'canteen_tenant_settings' })

schema.index({ tenantId: 1 }, { unique: true })

export default mongoose.model('CanteenTenantSettings', schema)

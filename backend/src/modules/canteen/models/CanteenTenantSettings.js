import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  defaultBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', default: null },
  canteenAllowedBranchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'CanteenBranch', default: [] },
  canteenDefaultBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', default: null },
  defaultVatRate: { type: Number, default: 0 },
  receiptHeader: { type: String, default: '' },
  receiptFooter: { type: String, default: '' },
  qrTitle: { type: String, default: '' },
  qrDescription: { type: String, default: '' },
  qrLogoUrl: { type: String, default: '' },
  qrCoverImageUrl: { type: String, default: '' },
  qrTheme: { type: String, default: 'green' },
  themeId: { type: String, default: 'default' },
  darkMode: { type: Boolean, default: false },
  qrPhone: { type: String, default: '' },
  qrWhatsapp: { type: String, default: '' },
  qrEmail: { type: String, default: '' },
  qrAddress: { type: String, default: '' },
  qrWorkingHours: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'canteen_tenant_settings' })

schema.index({ tenantId: 1 }, { unique: true })

export default mongoose.model('CanteenTenantSettings', schema)

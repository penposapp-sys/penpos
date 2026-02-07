import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  cashEnabled: { type: Boolean, default: true },
  cardEnabled: { type: Boolean, default: true },
  ibanEnabled: { type: Boolean, default: false },
  ibanText: { type: String, default: '' },
  posEnabled: { type: Boolean, default: true },
  bankEnabled: { type: Boolean, default: false },
  bankText: { type: String, default: '' },
  accountEnabled: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'canteen_tenant_payment_settings' })

schema.index({ tenantId: 1 }, { unique: true })

export default mongoose.model('CanteenTenantPaymentSettings', schema)

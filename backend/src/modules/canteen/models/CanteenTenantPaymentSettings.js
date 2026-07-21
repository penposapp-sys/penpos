import mongoose from 'mongoose'

const paymentMethodSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  type: { type: String, enum: ['cash', 'pos', 'bank', 'account', 'other'], default: 'other' },
  enabled: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { _id: false })

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
  paymentMethods: { type: [paymentMethodSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'canteen_tenant_payment_settings' })

schema.index({ tenantId: 1 }, { unique: true })

export default mongoose.model('CanteenTenantPaymentSettings', schema)

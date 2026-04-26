import mongoose from 'mongoose'

const MethodSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  bucket: { type: String, enum: ['cash', 'card', 'bank', 'account', 'other'], default: 'other' },
  isEnabled: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }
}, { _id: false })

const PaymentSettingsSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  branchId: { type: String, default: null, index: true },
  methods: { type: [MethodSchema], default: [] }
}, { timestamps: true })

export default mongoose.model('PaymentSettings', PaymentSettingsSchema)

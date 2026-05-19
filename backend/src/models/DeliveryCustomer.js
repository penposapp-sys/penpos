import mongoose from 'mongoose'

const deliveryCustomerSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    phoneDigits: { type: String, default: '', index: true },
    address: { type: String, default: '', trim: true, maxlength: 500 },
    note: { type: String, default: '', trim: true, maxlength: 300 },
    lastOrderAt: { type: Date, default: null }
  },
  { timestamps: true }
)

deliveryCustomerSchema.index({ tenantId: 1, phoneDigits: 1 })
deliveryCustomerSchema.index({ tenantId: 1, name: 1 })
deliveryCustomerSchema.index({ tenantId: 1, updatedAt: -1 })

export default mongoose.model('DeliveryCustomer', deliveryCustomerSchema)

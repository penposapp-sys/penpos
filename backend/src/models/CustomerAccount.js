import mongoose from 'mongoose'

const customerAccountSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    note: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    balance: { type: Number, default: 0 }
  },
  { timestamps: true }
)

export default mongoose.model('CustomerAccount', customerAccountSchema)

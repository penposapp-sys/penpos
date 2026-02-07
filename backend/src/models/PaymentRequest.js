import mongoose from 'mongoose'

const paymentRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: 'bank_transfer' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
)

paymentRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 })

export default mongoose.model('PaymentRequest', paymentRequestSchema)

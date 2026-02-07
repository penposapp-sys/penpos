import mongoose from 'mongoose'

const orderCounterSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    dayKey: { type: String, required: true, index: true },
    seq: { type: Number, default: 0 }
  },
  { timestamps: true }
)

orderCounterSchema.index({ tenantId: 1, dayKey: 1 }, { unique: true })

export default mongoose.model('OrderCounter', orderCounterSchema)

import mongoose from 'mongoose'

const branchSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    address: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

branchSchema.index({ tenantId: 1, name: 1 }, { unique: true })

export default mongoose.model('Branch', branchSchema)

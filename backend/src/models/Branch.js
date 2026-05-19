import mongoose from 'mongoose'

const branchSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    address: { type: String, default: '' },
    active: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    status: { type: String, default: 'active', index: true }
  },
  { timestamps: true }
)

branchSchema.index({ tenantId: 1, name: 1 }, { unique: true })
branchSchema.index({ tenantId: 1, isDeleted: 1, status: 1, isActive: 1 })

export default mongoose.model('Branch', branchSchema)

import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    qrMenuVisible: { type: Boolean, default: true },
    branchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] },
    active: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    status: { type: String, default: 'active', index: true }
  },
  { timestamps: true }
)

categorySchema.index({ tenantId: 1, isDeleted: 1, status: 1, isActive: 1 })
categorySchema.index({ tenantId: 1, branchIds: 1 })

export default mongoose.model('Category', categorySchema)

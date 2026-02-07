import mongoose from 'mongoose'

const tableSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['empty', 'occupied'], default: 'empty' },
    activeOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

export default mongoose.model('Table', tableSchema)

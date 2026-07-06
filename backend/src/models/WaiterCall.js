import mongoose from 'mongoose'

const waiterCallSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null, index: true },
    tableName: { type: String, default: '', trim: true },
    source: { type: String, enum: ['public_qr_menu'], default: 'public_qr_menu' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
    resolvedAt: { type: Date, default: null },
    resolvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

waiterCallSchema.index({ tenantId: 1, status: 1, createdAt: -1 })
waiterCallSchema.index({ tenantId: 1, tableId: 1, status: 1, createdAt: -1 })

export default mongoose.model('WaiterCall', waiterCallSchema)

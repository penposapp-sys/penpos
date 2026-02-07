import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  status: { type: String, enum: ['open', 'finished', 'closed'], default: 'open', index: true },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { collection: 'canteen_stock_count_sessions' })

schema.index({ tenantId: 1, branchId: 1, status: 1, startedAt: -1 })

export default mongoose.model('CanteenStockCountSession', schema)

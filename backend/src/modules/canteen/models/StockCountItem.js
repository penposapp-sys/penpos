import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenStockCountSession', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenProduct', required: true, index: true },
  barcode: { type: String, default: '', index: true },
  productSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  countedQty: { type: Number, default: 0 },
  currentStockAtStart: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'canteen_stock_count_items' })

schema.index({ tenantId: 1, branchId: 1, sessionId: 1, productId: 1 }, { unique: true })
schema.index({ tenantId: 1, branchId: 1, sessionId: 1, barcode: 1 })

export default mongoose.model('CanteenStockCountItem', schema)

import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenProduct', required: true, index: true },
  productName: { type: String, default: '' },
  barcode: { type: String, default: '', index: true },
  type: { type: String, enum: ['in', 'out', 'waste', 'adjust'], required: true },
  qty: { type: Number, required: true },
  note: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'canteen_stock_movements' })

schema.index({ tenantId: 1, branchId: 1, createdAt: -1 })
schema.index({ tenantId: 1, branchId: 1, productId: 1, createdAt: -1 })

export default mongoose.model('CanteenStockMovement', schema)

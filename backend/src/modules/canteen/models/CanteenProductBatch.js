import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenProduct', required: true, index: true },
  productName: { type: String, default: '' },
  barcode: { type: String, default: '', index: true },
  receivedQty: { type: Number, required: true, min: 0 },
  remainingQty: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  vatRate: { type: Number, default: 0 },
  vatIncluded: { type: Boolean, default: true },
  source: { type: String, default: 'manual' },
  note: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receivedAt: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'canteen_product_batches' })

schema.index({ tenantId: 1, branchId: 1, productId: 1, receivedAt: 1, _id: 1 })

export default mongoose.model('CanteenProductBatch', schema)

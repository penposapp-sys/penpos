import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenCategory', default: null, index: true },
  name: { type: String, required: true },
  nameNormalized: { type: String, required: true, index: true },
  barcode: { type: String, default: '', index: true },
  stockTrackingEnabled: { type: Boolean, default: false },
  stockQty: { type: Number, default: 0 },
  minimumStock: { type: Number, default: 5 },
  price: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  vatRate: { type: Number, default: 0 },
  vatIncluded: { type: Boolean, default: true },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  galleryImages: { type: [String], default: [] },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'canteen_products' })

schema.index({ tenantId: 1, branchId: 1, nameNormalized: 1 }, { unique: true })
schema.index(
  { tenantId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string', $ne: '' } } }
)

export default mongoose.model('CanteenProduct', schema)

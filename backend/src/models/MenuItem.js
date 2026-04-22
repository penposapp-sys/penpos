import mongoose from 'mongoose'

const menuItemSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    sku: { type: String, trim: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    barcode: { type: String, default: '' },
    vatRate: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: '' },
    isWeightBased: { type: Boolean, default: false },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
)

menuItemSchema.index(
  { tenantId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string', $ne: '' } } }
)

export default mongoose.model('MenuItem', menuItemSchema)

import mongoose from 'mongoose'

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenProduct', required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  lineTotal: { type: Number, required: true },
  vatRate: { type: Number, default: 0 },
  note: { type: String, default: '' }
}, { _id: false })

const paymentSchema = new mongoose.Schema({
  method: { type: String, required: true },
  methodName: { type: String, default: '' },
  methodType: { type: String, default: '' },
  amount: { type: Number, required: true },
  note: { type: String, default: '' }
}, { _id: false })

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenCustomer', default: null, index: true },
  items: { type: [itemSchema], default: [] },
  subTotal: { type: Number, required: true },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  discountTotal: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true },
  channel: { type: String, default: 'cashier', index: true },
  payment: { type: paymentSchema, required: true },
  note: { type: String, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { collection: 'canteen_sales' })

schema.index({ tenantId: 1, branchId: 1, createdAt: -1 })

export default mongoose.model('CanteenSale', schema)

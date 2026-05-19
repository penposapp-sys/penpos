import mongoose from 'mongoose'

const qrOrderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenProduct', required: true },
  productName: { type: String, required: true },
  categoryName: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  note: { type: String, default: '' }
}, { _id: false })

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: true, index: true },
  orderNumber: { type: String, required: true, index: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true, index: true },
  customerEmail: { type: String, default: '' },
  customerLocation: { type: String, required: true },
  customerAddress: { type: String, default: '' },
  customerNote: { type: String, default: '' },
  items: { type: [qrOrderItemSchema], default: [] },
  subtotal: { type: Number, required: true },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  discountTotal: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'pending', 'cari'], default: 'pending', index: true },
  paymentMethod: { type: String, enum: ['cash_at_counter', 'pay_on_delivery', 'cari', 'already_paid', 'none'], default: 'none' },
  paymentMethodLabel: { type: String, default: '' },
  paymentMethodName: { type: String, default: '' },
  paymentMethodBucket: { type: String, enum: ['cash', 'card', 'bank', 'account', 'other'], default: 'other' },
  paymentMethodType: { type: String, enum: ['cash', 'card', 'bank', 'credit', 'other'], default: 'other' },
  orderStatus: { type: String, enum: ['new', 'preparing', 'ready', 'delivered', 'cancelled'], default: 'new', index: true },
  isTransferredToCari: { type: Boolean, default: false },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenCustomer', default: null, index: true },
  cariId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenCustomer', default: null, index: true },
  relatedSaleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenSale', default: null },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { collection: 'canteen_qr_orders' })

schema.index({ tenantId: 1, branchId: 1, createdAt: -1 })
schema.index({ tenantId: 1, orderNumber: 1 }, { unique: true })

schema.pre('save', function syncUpdatedAt(next) {
  this.updatedAt = new Date()
  next()
})

export default mongoose.model('CanteenQrOrder', schema)

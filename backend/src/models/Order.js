import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['cash', 'card', 'transfer', 'other'], default: 'cash' },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

const itemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  nameSnapshot: { type: String, required: true },
  priceSnapshot: { type: Number, required: true, min: 0 },
  qty: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true, min: 0 },
  isWeightBased: { type: Boolean, default: false },
  weightGrams: { type: Number, default: null, min: 1 },
  note: { type: String, default: '' },
  servingType: { type: String, enum: ['tray', 'plate', 'package'], default: 'plate' },
  status: { type: String, enum: ['open', 'sent', 'completed', 'cancelled'], default: 'open' },
  sentAt: { type: Date, default: null },
  kitchenBatchId: { type: String, default: null },
  kitchenSentAt: { type: Date, default: null }
})

const kitchenBatchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true },
    servingType: { type: String, enum: ['tray', 'plate', 'package'], default: 'plate' },
    sentAt: { type: Date, default: null }
  },
  { _id: false }
)

const veresiyeEntrySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerAccount', required: true },
    accountName: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: null }
  },
  { timestamps: false }
)

const orderSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
    orderNo: { type: Number, default: null },
    orderDayKey: { type: String, default: '' },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null },
    status: { type: String, enum: ['open', 'sent', 'paid', 'cancelled', 'completed', 'merged', 'closed'], default: 'open' },
    items: { type: [itemSchema], default: [] },
    totals: {
      subtotal: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 }
    },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    payments: { type: [paymentSchema], default: [] },
    note: { type: String, default: '' },
    paymentMethod: { type: String, default: '' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    paidAt: { type: Date, default: null },
    settlementType: { type: String, enum: ['none', 'veresiye'], default: 'none' },
    veresiyeAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerAccount', default: null },
    veresiyeAmount: { type: Number, default: 0, min: 0 },
    veresiyeNote: { type: String, default: '' },
    veresiyeAt: { type: Date, default: null },
    veresiyeEntries: { type: [veresiyeEntrySchema], default: [] },
    mergedIntoOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    mergeSourceOrderIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    saleType: { type: String, enum: ['table', 'walkin', 'delivery'], default: 'table' },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerAddress: { type: String, default: '' },
    deliveryNote: { type: String, default: '' },
    deliveryStatus: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'], default: 'pending' },
    deliveryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    kitchenEnabled: { type: Boolean, default: true },
    sendToKitchen: { type: Boolean, default: true },
    currentKitchenBatchId: { type: String, default: null },
    kitchenBatches: { type: [kitchenBatchSchema], default: [] },
    cancelAlertActive: { type: Boolean, default: false },
    servingType: {
      type: String,
      enum: ['tray', 'plate', 'package'],
      default: function () {
        return String(this.saleType || '') === 'delivery' ? 'package' : 'plate'
      }
    },
    servingTypeUpdatedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

orderSchema.index({ tenantId: 1, createdAt: -1 })
orderSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 })
orderSchema.index({ tenantId: 1, branchId: 1, orderDayKey: 1, orderNo: 1 })

orderSchema.virtual('total').get(function () {
  const items = Array.isArray(this.items) ? this.items : []
  return items
    .filter(it => it && it.status !== 'cancelled')
    .reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0)
})

orderSchema.virtual('discountTotal').get(function () {
  const total = Number(this.total) || 0
  const pct = Number(this.discountPercent) || 0
  return (total * pct) / 100
})

orderSchema.virtual('netTotal').get(function () {
  const total = Number(this.total) || 0
  const discountTotal = Number(this.discountTotal) || 0
  return Math.max(0, total - discountTotal)
})

orderSchema.virtual('paidTotal').get(function () {
  const payments = Array.isArray(this.payments) ? this.payments : []
  const base = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const ver = this.settlementType === 'veresiye' ? (Number(this.veresiyeAmount) || 0) : 0
  return base + ver
})

orderSchema.virtual('balanceDue').get(function () {
  const net = Number(this.netTotal) || 0
  const paid = Number(this.paidTotal) || 0
  return Math.max(0, net - paid)
})

orderSchema.set('toObject', { virtuals: true })
orderSchema.set('toJSON', { virtuals: true })

export default mongoose.model('Order', orderSchema)

import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, default: 'cash' },
    methodId: { type: String, default: 'cash' },
    methodLabel: { type: String, default: '' },
    methodName: { type: String, default: '' },
    methodBucket: { type: String, enum: ['cash', 'card', 'bank', 'account', 'other'], default: 'other' },
    methodType: { type: String, enum: ['cash', 'card', 'bank', 'credit', 'other'], default: 'other' },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    itemAllocations: {
      type: [{
        itemId: { type: String, default: '' },
        menuItemId: { type: String, default: '' },
        qty: { type: Number, default: 0, min: 0 },
        subtotal: { type: Number, default: 0, min: 0 }
      }],
      default: []
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

const itemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
  productName: { type: String, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  categoryName: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  nameSnapshot: { type: String, required: true },
  priceSnapshot: { type: Number, required: true, min: 0 },
  qty: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true, min: 0 },
  isWeightBased: { type: Boolean, default: false },
  weightGrams: { type: Number, default: null, min: 1 },
  note: { type: String, default: '' },
  servingType: { type: String, enum: ['tray', 'plate', 'package'], default: 'plate' },
  status: { type: String, enum: ['open', 'sent', 'cooking', 'completed', 'cancelled'], default: 'open' },
  sentAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: '' },
  kitchenBatchId: { type: String, default: null },
  kitchenSentAt: { type: Date, default: null },
  kitchenPrintedAt: { type: Date, default: null }
})

const kitchenBatchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true },
    servingType: { type: String, enum: ['tray', 'plate', 'package'], default: 'plate' },
    sentAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { _id: false }
)

const veresiyeEntrySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerAccount', required: true },
    accountName: { type: String, default: '' },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountTransaction', default: null },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: null }
  },
  { timestamps: false }
)

const deliveryAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    addressText: { type: String, default: '' },
    district: { type: String, default: '' },
    neighborhood: { type: String, default: '' },
    note: { type: String, default: '' },
    mapUrl: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  { _id: false }
)

const deliveryEventSchema = new mongoose.Schema(
  {
    type: { type: String, default: '' },
    oldStatus: { type: String, default: '' },
    newStatus: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: '' },
    note: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    branchName: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByUserName: { type: String, default: '' },
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
    orderChannel: { type: String, enum: ['manual', 'online', 'qr'], default: 'manual' },
    approvalStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    cancelRequestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    cancelRequestedAt: { type: Date, default: null },
    cancelRequestedByName: { type: String, default: '' },
    cancelRequestNote: { type: String, default: '' },
    deliveryType: { type: String, enum: ['table', 'takeaway', 'package'], default: null },
    deliveryCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryCustomer', default: null },
    publicCustomerAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerAccount', default: null },
    publicCustomerLocation: { type: String, default: '' },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerAddress: { type: String, default: '' },
    deliveryNote: { type: String, default: '' },
    deliveryPaymentStatus: { type: String, enum: ['unknown', 'pay_on_delivery', 'already_paid', 'odeme_bekliyor', 'odeme_alindi', 'veresiye', 'online_odendi', 'iade_edildi'], default: 'unknown' },
    deliveryPaymentMethod: { type: String, default: '' },
    deliveryPaymentMethodLabel: { type: String, default: '' },
    deliveryStatus: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled', 'yeni', 'hazirlaniyor', 'kuryeye_atandi', 'yola_cikti', 'teslim_edildi', 'iptal_edildi', 'musteriyi_bulamadi', 'adreste_yok', 'geri_dondu'], default: 'pending' },
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    courierName: { type: String, default: '' },
    courierAssignedAt: { type: Date, default: null },
    courierDepartedAt: { type: Date, default: null },
    deliveryAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    deliveryAddress: { type: deliveryAddressSchema, default: () => ({}) },
    deliveryEvents: { type: [deliveryEventSchema], default: [] },
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

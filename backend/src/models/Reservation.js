import mongoose from 'mongoose'

const historySchema = new mongoose.Schema({
  status: { type: String, default: '' },
  action: { type: String, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  changedAt: { type: Date, default: Date.now },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false })

const reservationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', default: null, index: true },
  customerName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 40 },
  guestCount: { type: Number, required: true, min: 1, max: 100 },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true },
  note: { type: String, default: '', maxlength: 1000 },
  source: { type: String, enum: ['staff', 'website'], default: 'staff' },
  customerAccessKeyHash: { type: String, default: '', select: false },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'],
    default: 'pending',
    index: true
  },
  holdExpiresAt: { type: Date, default: null, index: true },
  slotKeys: { type: [String], default: [] },
  history: { type: [historySchema], default: [] },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderOpening: { type: Boolean, default: false }
}, { timestamps: true })

reservationSchema.index(
  { tenantId: 1, branchId: 1, tableId: 1, slotKeys: 1 },
  {
    unique: true,
    name: 'reservation_table_slot_nonempty_unique',
    partialFilterExpression: {
      tableId: { $type: 'objectId' },
      slotKeys: { $gt: [] }
    }
  }
)
reservationSchema.index({ tenantId: 1, branchId: 1, startAt: 1, status: 1 })
reservationSchema.index({ tenantId: 1, branchId: 1, customerAccessKeyHash: 1, startAt: -1 })

export default mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema)

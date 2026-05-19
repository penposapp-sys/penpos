import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenBranch', required: false, default: null, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenCustomer', required: true, index: true },
  method: { type: String, enum: ['cash', 'pos', 'bank', 'discount'], required: true },
  amount: { type: Number, required: true },
  note: { type: String, default: '' },
  isActive: { type: Boolean, default: true, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deleteReason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { collection: 'canteen_customer_collections' })

schema.index({ tenantId: 1, customerId: 1, createdAt: -1 })

export default mongoose.model('CanteenCustomerCollection', schema)

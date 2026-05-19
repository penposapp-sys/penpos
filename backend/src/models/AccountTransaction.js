import mongoose from 'mongoose'

const accountTransactionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerAccount', required: true, index: true },
    type: { type: String, enum: ['debit', 'credit'], required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, default: 'other' },
    methodId: { type: String, default: 'other' },
    methodLabel: { type: String, default: '' },
    methodName: { type: String, default: '' },
    methodBucket: { type: String, enum: ['cash', 'card', 'bank', 'account', 'other'], default: 'other' },
    methodType: { type: String, enum: ['cash', 'card', 'bank', 'credit', 'other'], default: 'other' },
    note: { type: String, default: '' },
    lines: [{
      menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
      name: { type: String, default: '' },
      qty: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
      lineTotal: { type: Number, default: 0 },
      note: { type: String, default: '' }
    }],
    source: { type: String, enum: ['order_veresiye', 'order_veresiye_delete', 'collection', 'manual'], required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

accountTransactionSchema.index({ tenantId: 1, branchId: 1, accountId: 1, createdAt: -1 })

export default mongoose.model('AccountTransaction', accountTransactionSchema)

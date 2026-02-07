import mongoose from 'mongoose'

const kitchenBulkPrepStateSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true, index: true },
    sourceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    sourceItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    rowKey: { type: String, required: true },
    tableName: { type: String, default: '' },
    qty: { type: Number, default: 1, min: 1 },
    createdAt: { type: Date, default: null },
    isDone: { type: Boolean, default: true },
    doneAt: { type: Date, default: null },
    doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
)

kitchenBulkPrepStateSchema.index({ tenantId: 1, rowKey: 1 }, { unique: true })
kitchenBulkPrepStateSchema.index({ tenantId: 1, branchId: 1, isDone: 1, doneAt: -1 })

export default mongoose.model('KitchenBulkPrepState', kitchenBulkPrepStateSchema)


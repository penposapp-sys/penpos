import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    system: { type: String, enum: ['kermes', 'canteen'], required: true, index: true },
    name: { type: String, required: true },
    windowsPrinterName: { type: String, default: '' },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true, collection: 'print_printers' }
)

schema.index({ tenantId: 1, system: 1, name: 1 }, { unique: true })

export default mongoose.model('PrintPrinter', schema)

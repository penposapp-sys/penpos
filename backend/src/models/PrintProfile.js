import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    system: { type: String, enum: ['kermes', 'canteen'], required: true, index: true },
    code: { type: String, default: '', index: true },
    name: { type: String, required: true },
    printerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrintPrinter', required: true, index: true },
    payloadType: { type: String, enum: ['raw', 'html', 'pdf_base64'], default: 'raw' },
    options: { type: Object, default: {} },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true, collection: 'print_profiles' }
)

schema.index({ tenantId: 1, system: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string', $ne: '' } } })

export default mongoose.model('PrintProfile', schema)


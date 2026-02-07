import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    system: { type: String, enum: ['kermes', 'canteen'], required: true, index: true },
    type: { type: String, enum: ['receipt', 'label'], required: true, index: true },
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrintStation', default: null, index: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrintProfile', required: true, index: true },
    status: { type: String, enum: ['queued', 'printing', 'printed', 'failed', 'canceled'], default: 'queued', index: true },
    payload: {
      type: { type: String, enum: ['raw', 'html', 'pdf_base64'], default: 'raw' },
      content: { type: String, default: '' }
    },
    meta: { type: Object, default: {} },
    attempts: { type: Number, default: 0 },
    lockedByStationId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrintStation', default: null, index: true },
    lockedAt: { type: Date, default: null, index: true },
    printedAt: { type: Date, default: null },
    lastError: { type: Object, default: null },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, collection: 'print_jobs' }
)

schema.index({ tenantId: 1, system: 1, stationId: 1, status: 1, createdAt: 1 })

export default mongoose.model('PrintJob', schema)

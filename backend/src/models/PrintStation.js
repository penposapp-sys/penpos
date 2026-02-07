import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    system: { type: String, enum: ['kermes', 'canteen'], required: true, index: true },
    name: { type: String, required: true },
    secretHash: { type: String, default: '' },
    branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    assignedProfileIds: { type: [mongoose.Schema.Types.ObjectId], default: [], index: true },
    isActive: { type: Boolean, default: false, index: true },
    lastHeartbeatAt: { type: Date, default: null, index: true },
    lastHeartbeatMeta: { type: Object, default: { hostname: '', version: '', printers: [] } },
    lastSeenAt: { type: Date, default: null, index: true },
    lastSeenMeta: { type: Object, default: {} }
  },
  { timestamps: true, collection: 'print_stations' }
)

schema.index({ tenantId: 1, system: 1, name: 1 }, { unique: true })

export default mongoose.model('PrintStation', schema)

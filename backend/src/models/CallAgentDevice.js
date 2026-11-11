import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    pairingSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CallAgentPairingSession', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    branchIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }], default: [] },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
    pairedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pairedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastHeartbeatAt: { type: Date, default: null, index: true },
    lastHeartbeatMeta: {
      hostname: { type: String, default: '' },
      version: { type: String, default: '' }
    }
  },
  { timestamps: true, collection: 'call_agent_devices' }
)

schema.index({ tenantId: 1, branchId: 1, status: 1 })

export default mongoose.model('CallAgentDevice', schema)

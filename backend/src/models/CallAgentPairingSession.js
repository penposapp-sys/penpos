import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: '', trim: true, maxlength: 100 },
    codeHash: { type: String, required: true },
    codeSalt: { type: String, required: true },
    pollSecretHash: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'consumed', 'expired', 'locked'], default: 'pending', index: true },
    failedAttempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    deleteAt: { type: Date, required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    branchIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }], default: [] },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    tokenSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CallAgentTokenSession', default: null },
    consumedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'call_agent_pairing_sessions' }
)

schema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model('CallAgentPairingSession', schema)

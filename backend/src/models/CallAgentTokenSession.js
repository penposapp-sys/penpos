import mongoose from 'mongoose'

const schema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'CallAgentDevice', required: true, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    familyId: { type: String, required: true, unique: true },
    accessTokenHash: { type: String, required: true, unique: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    refreshTokenHistory: { type: [String], default: [] },
    accessExpiresAt: { type: Date, required: true },
    refreshExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true, collection: 'call_agent_token_sessions' }
)

schema.index({ deviceId: 1, revokedAt: 1 })

export default mongoose.model('CallAgentTokenSession', schema)

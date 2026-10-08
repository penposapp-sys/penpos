import mongoose from 'mongoose'

const tenantUsageSessionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionKey: { type: String, required: true },
  startedAt: { type: Date, required: true },
  lastHeartbeatAt: { type: Date, required: true },
  lastActiveAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 }
}, { timestamps: true })

tenantUsageSessionSchema.index({ tenantId: 1, lastHeartbeatAt: -1 })
tenantUsageSessionSchema.index({ tenantId: 1, endedAt: 1, lastHeartbeatAt: 1 })
tenantUsageSessionSchema.index(
  { tenantId: 1, userId: 1, sessionKey: 1 },
  { unique: true, partialFilterExpression: { endedAt: null } }
)

export default mongoose.model('TenantUsageSession', tenantUsageSessionSchema)

import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false, index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: false, default: null, index: true },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
)

auditLogSchema.index({ tenantId: 1, createdAt: -1 })
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 })
auditLogSchema.index({ tenantId: 1, actorUserId: 1, createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)

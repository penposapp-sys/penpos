import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  requestedPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null, index: true },
  requestedPlanSnapshot: {
    name: { type: String, default: '' },
    price: { type: Number, default: 0 },
    limits: { type: mongoose.Schema.Types.Mixed, default: null },
    features: { type: mongoose.Schema.Types.Mixed, default: null },
    systemType: { type: String, default: '' }
  },
  requestedPlan: { type: String, default: '' },
  requestedLimits: { type: mongoose.Schema.Types.Mixed, default: null },
  note: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  decisionNote: { type: String, default: '' }
}, { collection: 'membership_requests', timestamps: true })

schema.index({ tenantId: 1, createdAt: -1 })
schema.index({ tenantId: 1, status: 1, createdAt: -1 })
schema.index({ requestedPlanId: 1, status: 1, createdAt: -1 })

export default mongoose.model('MembershipRequest', schema)

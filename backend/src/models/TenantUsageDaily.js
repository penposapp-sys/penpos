import mongoose from 'mongoose'

const tenantUsageDailySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  date: { type: String, required: true },
  durationSeconds: { type: Number, default: 0 }
}, { timestamps: true })

tenantUsageDailySchema.index({ tenantId: 1, date: 1 }, { unique: true })

export default mongoose.model('TenantUsageDaily', tenantUsageDailySchema)

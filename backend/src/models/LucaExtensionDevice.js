import mongoose from 'mongoose'

const lucaExtensionDeviceSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: 'PenPOS Luca Cihazı' },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['online', 'offline', 'revoked'], default: 'offline', index: true },
    lastSeen: { type: Date, default: null, index: true },
    revokedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

lucaExtensionDeviceSchema.index({ tenant: 1, deviceId: 1 }, { unique: true })

export default mongoose.model('LucaExtensionDevice', lucaExtensionDeviceSchema)

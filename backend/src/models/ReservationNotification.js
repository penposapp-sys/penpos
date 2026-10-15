import mongoose from 'mongoose'

const reservationNotificationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  readAt: { type: Date, default: null, index: true }
}, { timestamps: true })

reservationNotificationSchema.index({ reservationId: 1, userId: 1 }, { unique: true })
reservationNotificationSchema.index({ tenantId: 1, branchId: 1, userId: 1, readAt: 1, createdAt: -1 })

export default mongoose.models.ReservationNotification || mongoose.model('ReservationNotification', reservationNotificationSchema)

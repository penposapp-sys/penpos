import mongoose from 'mongoose'

const planSchema = new mongoose.Schema(
  {
    systemType: { type: String, enum: ['restaurant', 'canteen'], default: 'restaurant', required: true, index: true },
    packageType: { type: String, enum: ['restaurant', 'canteen'], default: null, index: true },
    vertical: { type: String, enum: ['restaurant', 'canteen'], default: null, index: true },
    name: { type: String, required: true, index: true },
    price: { type: Number, default: 0 },
    limits: {
      products: { type: Number, default: -1 },
      tables: { type: Number, default: -1 },
      staff: { type: Number, default: -1 }
    },
    features: {
      reports: { type: Boolean, default: false },
      kitchen: { type: Boolean, default: false }
    },
    trialDays: { type: Number, default: 0 },
    isTrial: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

planSchema.index({ systemType: 1, name: 1 }, { unique: true })
planSchema.index({ packageType: 1, isTrial: 1, trialDays: 1, isActive: 1 })

export default mongoose.model('Plan', planSchema)
